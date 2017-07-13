const WebSocket = require('ws') 
var dateFormat = require('dateformat')
var NodeGeocoder = require('node-geocoder')

/* The following variables define the positions of the variables in the 96 bit array. This is a pre-determined bitarray, each variable has a certain amount of space. 
   When the positions in the bitstring change, these positions need to change  */
/* Some variables need to have a certain amount subtracted, this was done so they fit in a certain range(i.e 0 to 100 for the temperature instead of -50 and 50) 
   The amount that needs to be substracted is also changeable */
var latitudeBitsPosition = [8, 33]
var longitudeBitsPosition = [33, 59]
var temperatureBitsPosition = [59, 69]
var humidityBitsPosition = [69, 76]
var nitroBitsPosition = [76, 86]
var particulatesBitsPosition = [86, 96]

var latitudeCorrection = 90.00000;
var longitudeCorrection = 180.00000;
var temperatureCorrection = 50;

var lastSocketMessageTime = Date.now()
var lastMessageID;

var nodeGeocoderOptions =
    {
        provider: 'google',
        httpAdapter: 'https',
        apiKey: 'AIzaSyBrAOQEhFWjCgMGUzS_ZHwlPKWYMbacDVs',
    }
var geocoder = NodeGeocoder(nodeGeocoderOptions)

var snuffelSocket = new WebSocket("wss://www.italks.eu/app?token=vnoAxwAAAA13d3cuaXRhbGtzLmV1swkEpDqBazKCGlMgWAFvJw==")

var databaseConnection = require('./config.js').localConnect()          // The database connection info is defined in a seperate file named config.js. The MySQL user needs at least an INSERT grant

var SQLInsertQuery = 'INSERT INTO measurements (measurement_datetime,location_latitude,location_longitude,location_address,temperature,humidity,nitrodioxide,particulates) VALUES (?,?,?,?,?,?,?,?)'
databaseConnection.connect(function (err)
{
    if (!err)
    {
        console.log("Database is connected ...")
    } else
    {
        console.log("Error connecting database ...")
    }
})
snuffelSocket.onmessage = function (event) 
{
    var tempMessageData = JSON.parse(event.data)
    var messageTime = new Date(tempMessageData.ts)
    // The following if statement checks for duplicate messages. The timestamp is from the LoRa messages and defined when the hardware sends messages ot the gateway
    if (typeof lastSocketMessageTime !== 'undefined' && lastSocketMessageTime !== null)            // The first time the function is executed, this is undefined. That is why this needs to be checked
    {
        if (Math.abs(messageTime.getTime() == lastSocketMessageTime.getTime()))                         // Compare the current message timestamp to the previous message timestamp.
        {
            console.log("Too soon")
            return                                                                                          // If the same LoRa measurement showed up again, exit the function 
        }
        else
        {
            var lastSocketMessageTime = messageTime                                                         // If it is not the same message, continue with the function
        }
    }
    else
    {
        var lastSocketMessageTime = messageTime                                                         // Continue with the function since this is te first time executing this function
    }
    var data = tempMessageData.data
    if ((typeof data == undefined))                                                               // Check for corrupt messages
    {
        return                                                                                         // Exit the function
    }
    /* The following lines extract the variables from the bitstring, using the positions defined at the top of this script. A correction is applied to make negative numbers possible. 
    Division is applied for decimal numbers  */
    try
    {
        convertedBitsFromHex = hexToBinary(String(data))
        var latitudeBits = convertedBitsFromHex.toString().slice(latitudeBitsPosition[0], latitudeBitsPosition[1])
        var latitudeDecimal = (parseInt(latitudeBits, 2) / 100000) - latitudeCorrection
        var longitudeBits = convertedBitsFromHex.toString().slice(longitudeBitsPosition[0], longitudeBitsPosition[1])
        var longitudeDecimal = (parseInt(longitudeBits, 2) / 100000) - longitudeCorrection
        var temperatureBits = convertedBitsFromHex.toString().slice(temperatureBitsPosition[0], temperatureBitsPosition[1])
        var temperatureDecimal = (parseInt(temperatureBits, 2) / 10) - temperatureCorrection
        var humidityBits = convertedBitsFromHex.toString().slice(humidityBitsPosition[0], humidityBitsPosition[1])
        var humidityDecimal = parseInt(humidityBits, 2)
        var nitroBits = convertedBitsFromHex.toString().slice(nitroBitsPosition[0], nitroBitsPosition[1])
        var nitroDecimal = parseInt(nitroBits, 2) / 10
        var particulatesBits = convertedBitsFromHex.toString().slice(particulatesBitsPosition[0], particulatesBitsPosition[1])
        var particulatesDecimal = parseInt(particulatesBits, 2) / 10
    }
    catch (ex)          // Catch exceptions like index out of range, parse errors.
    {
        console.log(ex)
        return              // Exit the function
    }
    if (!isNaN(latitudeDecimal) && (latitudeDecimal != 0))          // Check for corrupt messages and/or measurements with no location data
    {
        geocoder.reverse({ lat: latitudeDecimal, lon: longitudeDecimal })
        .then(function (res)                                        // When the async operation, the reverse geocoding, finishes, the following code is executed. It saves the address from the geocoder and queries the database 
        {
            if ("extra" in res[0])                                      // Check if the geocoder has reverse geocoded useful information(the neighborhood in this case)
            {
                var address = res[0].extra.neighborhood                     // Set the address variable to the neighborhood (i.e 'Centrum' for Hogeschool Rotterdam Wijnhaven)
            }
            else
            {
                var address = 'No address available'                        // Set the address variable to 'No adress available' (i.e in the ocean)
            }
            // Query the database, the mysql library automatically escapes the query to prevent SQL injection. 
            return databaseConnection.query(SQLInsertQuery, [messageTime.toISOString().slice(0, 19).replace('T', ' '), latitudeDecimal, longitudeDecimal, address, temperatureDecimal, humidityDecimal, nitroDecimal, particulatesDecimal])
        })
        .catch(function(err)                                        // Catch exceptions while geocoding. Continue the execution of the function
        {
            console.log("Error while geocoding:")
            console.log(err)
        })
        .then(function (rows)                                       // When the query finishes, the following code is executed. The affected rows (from the query) can be found in the 'rows' variable
        {
            console.log("New measurement measured at :" + messageTime)
            console.log('GPS Latitude is : ' + latitudeDecimal)
            console.log('GPS Longitude is : ' + longitudeDecimal)
            console.log('Temperature measurement : ' + temperatureDecimal)
            console.log('Humidity measurement : ' + humidityDecimal)
            console.log('Nitrooxide measurement : ' + nitroDecimal)
            console.log('Particulates measurement : ' + particulatesDecimal)
        })
        .catch(function (error) // When the query function throws an error , the following code is executed. In the error
        {
            console.log(error)
        })
    }
    else                                                            // We can assume this is either a corrupt message or there is no location attached to the measurement. Either way, a useless measurement.
    {
        console.log("No GPS")
    }
}
function binaryToHex(s) 
{
    var i, k, part, accum, ret = ''                 // i = position in the full string, k = the position in the nibbles, part = the nibbles, accum = the hex in decimal number, ret = the total hex string 
    for (i = s.length - 1; i >= 3; i -= 4) 
    {
        /* extract out in substrings of 4 and convert to hex */
        part = s.substr(i + 1 - 4, 4)
        accum = 0
        for (k = 0; k < 4; k += 1) 
        {
            if (part[k] !== '0' && part[k] !== '1') 
            {
                // invalid character
                return { valid: false }
            }
            // compute the length 4 substring
            accum = accum * 2 + parseInt(part[k], 10)
            // 0101 = 5
            // accum = parseInt(0,10) = 0
            // accum = 0 * 2 + parseInt(1,10) = 1
            // accum = 1 * 2 + parseInt(0,10) = 2
            // accum = 2 * 2 + parseInt(1,10) = 5
        }
        if (accum >= 10)
        {
            // 'A' to 'F'
            ret = String.fromCharCode(accum - 10 + 'A'.charCodeAt(0)) + ret             // 10 to 16 becomes A to F because the Unicode values for A to F are next to each other
        }
        else 
        {
            // '0' to '9'
            ret = String(accum) + ret                                                   // Convert directly to Hex because the decimal values are under 10
        }
    }
    // remaining characters, i = 0, 1, or 2
    if (i >= 0) 
    {
        accum = 0
        // convert from front
        for (k = 0; k <= i; k += 1) 
        {
            if (s[k] !== '0' && s[k] !== '1')                                          // Check for values that are not binary
            {
                return { valid: false }
            }
            accum = accum * 2 + parseInt(s[k], 10)                                     
        }
        
        ret = String(accum) + ret                                                       // 3 bits, max value 7, so directly convert to Hex
    }
    return ret
}
function hexToBinary(s) 
{
    var i, k, part, ret = ''
    // lookup table for easier conversion. '0' characters are padded for '1' to '7'
    var lookupTable =
        {
            '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
            '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
            'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
            'e': '1110', 'f': '1111',
            'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
            'E': '1110', 'F': '1111'
        }
    for (i = 0; i < s.length; i += 1) 
    {
        if (lookupTable.hasOwnProperty(s[i]))                                           // If value (for example 'A') is in table
        {
            ret += lookupTable[s[i]]                                                    // Append the value from the table to the string
        } else
        {
            return { valid: false }                                                     // Value is not a hex
        }
    }
    return ret
}