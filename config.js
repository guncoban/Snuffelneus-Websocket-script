var mysql = function localConnect()
{
    return require('mysql').createConnection
    ({
        hostname: 'localhost',
        user: 'script',
        password: 'SnEuromast2017',
        database: 'snuffelneus'
    });
}
module.exports.localConnect = mysql;