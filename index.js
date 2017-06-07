const WebSocket = require('ws');
var dateFormat = require('dateformat');
var mysql = require("mysql");

var simulateLora = 0;
var convertedBitsFromHex;
var latitudeDecimal;
var longitudeBits;
var longitudeDecimal;
var temperatureBits;
var temperatureDecimal;
var humidityBits;
var humidityDecimal;
var nitroBits;
var nitroDecimal;
var particulatesBits;
var particulatesDecimal;
var address;
var lastSocketMessageTime = Date.now();

var googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyBrAOQEhFWjCgMGUzS_ZHwlPKWYMbacDVs'
});

var snuffelSocket = new WebSocket("wss://www.italks.eu/app?token=vnoAxwAAAA13d3cuaXRhbGtzLmV1swkEpDqBazKCGlMgWAFvJw==");
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '0945',
    database: 'snuffelneus'
});
var SQL = 'INSERT INTO metingen(datum,lat,longitude,temperatuur,luchtvochtigheid,stikstof,fijnstof) VALUES = (?,?,?,?,?,?,?)'
connection.connect(function (err)
{
    if (!err)
    {
        console.log("Database is connected ...");
    } else
    {
        console.log("Error connecting database ...");
    }
});
snuffelSocket.onmessage = function (event) 
{
    var tempMessageData = JSON.parse(event.data);
    var messageTime = new Date(tempMessageData.ts);
    if (Math.abs(messageTime.getTime() - lastSocketMessageTime.getTime()) < 2500) 
    {
        return;
    }
    else
    {
        var lastSocketMessageTime = messageTime;
    }
    messageTime.setHours(messageTime.getHours() + 2);
    var data = tempMessageData.data;

    convertedBitsFromHex = hexToBinary(String(data));
    console.log(String(data));
    console.log(convertedBitsFromHex);
    var latitudeBits = convertedBitsFromHex.toString().slice(8, 33)
    var latitudeDecimal = (parseInt(latitudeBits, 2) / 100000) - 90.00000
    var longitudeBits = convertedBitsFromHex.toString().slice(33, 59)
    var longitudeDecimal = (parseInt(longitudeBits, 2) / 100000) - 180.00000
    var temperatureBits = convertedBitsFromHex.toString().slice(59, 69)
    var temperatureDecimal = (parseInt(temperatureBits, 2) / 10) - 50
    var humidityBits = convertedBitsFromHex.toString().slice(69, 76)
    var humidityDecimal = parseInt(humidityBits, 2)
    var nitroBits = convertedBitsFromHex.toString().slice(76, 86)
    var nitroDecimal = parseInt(nitroBits, 2) / 10
    var particulatesBits = convertedBitsFromHex.toString().slice(86, 96)
    var particulatesDecimal = parseInt(particulatesBits, 2) / 10

    googleMapsClient.reverseGeocode
        ({
            latlng: [latitudeDecimal, longitudeDecimal],
        }, function (err, response)
        {
            if (!err) 
            {
                var address = response.json.results[1].formatted_address;   
            }
            else
            {
                var address = 'Geen adres beschikbaar';
                console.log(err);
            }
        });
     
    console.log("New measurement measured at :" + messageTime);
    console.log('GPS Latitude is : ' + latitudeDecimal)
    console.log('GPS Longitude is : ' + longitudeDecimal)
    console.log('Address is : ' + address)
    console.log('Temperature measurement : ' + temperatureDecimal)
    console.log('Humidity measurement : ' + humidityDecimal)
    console.log('Nitrooxide measurement : ' + nitroDecimal)
    console.log('Particulates measurement : ' + particulatesDecimal)


    connection.query('INSERT INTO measurements (measurement_datetime,location_latitude,location_longitude,location_address,temperature,humidity,nitrodioxide,particulates) VALUES (?,?,?,?,?,?,?,?)', [messageTime.toISOString().slice(0, 19).replace('T', ' '), latitudeDecimal, longitudeDecimal, address, temperatureDecimal, humidityDecimal, nitroDecimal, particulatesDecimal]);
    //console.log(event.data);
}
function simulateMessage() 
{
    var messageTime = new Date(2017, 1, 1, 12, 45, 23, 0);
    var bits = '1001010100011101000000001110000010101001100110101111100000010111011010001011001100111111'
    //var convertedBits = hexToBinary("80884E22448A27781768B33F");
    var convertedBitsToHex = binaryToHex(bits);
    //console.log(convertedBitsToHex);
    var convertedBitsFromHex = hexToBinary(convertedBitsToHex);
    console.log(convertedBitsFromHex)
    //var latitudeBits = convertedBitsFromHex.toString().slice(8, 33)
    //var latitudeDecimal = (parseInt(latitudeBits, 2) / 100000) - 90.00000
    var latitudeDecimal = 51.91871;
    //var longitudeBits = convertedBitsFromHex.toString().slice(33, 59)
    //var longitudeDecimal = (parseInt(longitudeBits, 2) / 100000) - 180.00000
    var longitudeDecimal = 4.43679;
    var temperatureBits = convertedBitsFromHex.toString().slice(59, 69)
    var temperatureDecimal = (parseInt(temperatureBits, 2) / 10) - 50
    var humidityBits = convertedBitsFromHex.toString().slice(69, 76)
    var humidityDecimal = parseInt(humidityBits, 2) / 10
    var nitroBits = convertedBitsFromHex.toString().slice(76, 86)
    var nitroDecimal = parseInt(nitroBits, 2) / 10
    var particulatesBits = convertedBitsFromHex.toString().slice(86, 96)
    var particulatesDecimal = parseInt(particulatesBits, 2) / 10
    console.log('GPS Latitude is : ' + latitudeDecimal)
    console.log('GPS Longitude is : ' + longitudeDecimal)
    console.log('Temperature measurement : ' + temperatureDecimal)
    console.log('Humidity measurement : ' + humidityDecimal)
    console.log('Nitrooxide measurement : ' + nitroDecimal)
    console.log('Particulates measurement : ' + particulatesDecimal)
    var data = 'AA';
    var messageLat = 52.14666;
    var messageLong = 14.24561;

    googleMapsClient.reverseGeocode
        ({
            latlng: [latitudeDecimal, longitudeDecimal],
        }, function (err, response)
        {
            if (!err) 
            {
                var address = response.json.results[1].formatted_address;
                console.log(address);   
            }
            else
            {
                var address = '';
                console.log(err);
            }
        });
    console.log(address);
    //connection.query('INSERT INTO measurements (measurement_datetime,location_latitude,location_longitude,temperature,humidity,nitrodioxide,particulates) VALUES (?,?,?,?,?,?,?)', [messageTime.toISOString().slice(0, 19).replace('T', ' '),messageLat,messageLong,2,2,1,1]);
    //connection.query('INSERT INTO measurements (measurement_datetime,location_latitude,location_longitude,temperature,humidity,nitrodioxide,particulates) VALUES ("2017-02-01 11:45:23",52.14666,14.24561,2.0,2,1.0,1.0)');
}
function binaryToHex(s) 
{
    var i, k, part, accum, ret = '';
    for (i = s.length - 1; i >= 3; i -= 4) 
    {
        // extract out in substrings of 4 and convert to hex
        part = s.substr(i + 1 - 4, 4);
        accum = 0;
        for (k = 0; k < 4; k += 1) 
        {
            if (part[k] !== '0' && part[k] !== '1') 
            {
                // invalid character
                return { valid: false };
            }
            // compute the length 4 substring
            accum = accum * 2 + parseInt(part[k], 10);
        }
        if (accum >= 10) 
        {
            // 'A' to 'F'
            ret = String.fromCharCode(accum - 10 + 'A'.charCodeAt(0)) + ret;
        }
        else 
        {
            // '0' to '9'
            ret = String(accum) + ret;
        }
    }
    // remaining characters, i = 0, 1, or 2
    if (i >= 0) 
    {
        accum = 0;
        // convert from front
        for (k = 0; k <= i; k += 1) 
        {
            if (s[k] !== '0' && s[k] !== '1') 
            {
                return { valid: false };
            }
            accum = accum * 2 + parseInt(s[k], 10);
        }
        // 3 bits, value cannot exceed 2^3 - 1 = 7, just convert
        ret = String(accum) + ret;
    }
    return ret;
}
function hexToBinary(s) 
{
    var i, k, part, ret = '';
    // lookup table for easier conversion. '0' characters are padded for '1' to '7'
    var lookupTable =
        {
            '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
            '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
            'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
            'e': '1110', 'f': '1111',
            'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
            'E': '1110', 'F': '1111'
        };
    for (i = 0; i < s.length; i += 1) 
    {
        if (lookupTable.hasOwnProperty(s[i])) 
        {
            ret += lookupTable[s[i]];
        } else
        {
            return { valid: false };
        }
    }
    return ret;
}
//setInterval(simulateMessage,2000)
