var express = require('express');
var app = express();
var http = require('http').Server(app);
var Hashids = require('hashids');
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var sha256 = require('js-sha256').sha224;
var cool = require('cool-ascii-faces');

var pg = require('pg');

app.set('port', (process.env.PORT || 3000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


var pool = new pg.Client(process.env.DATABASE_URL);
var client= undefined;

pool.connect(function(err, _client, done) {
    client = _client;
});

var hashidsSalt = 'testowy';
var keySalt = 'testowy';

var hashids = new Hashids(hashidsSalt, 10, '1234567890qwertyuiopasdfghjklzxcvbnm');


app.get('/', function(request, response) {
    response.render('pages/index')
});


app.get('/get-link', function(req, res){

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log(ip);
    var ipNumber = ip.replace(/[^0-9]/g, '');
    ipNumber = parseInt(ipNumber);

    var roomID =parseInt('0'+(+ new Date())+ipNumber);

    var roomHash = hashids.encode(roomID);

    console.log(ipNumber, roomID, roomHash);
    res.send({
        conversation_id:roomHash+':'+sha256(roomID+''+keySalt)
    });

});
app.get(/^\/chat\/([a-zA-Z0-9]+):([a-zA-Z0-9]+)$/, function(request, response){

    response.render('pages/chat')
});


function sendToMyRooms(socket, data) {
    console.log(data, socket.rooms);
    for (var room in socket.rooms) {
        if (room == socket.id) continue;

        io.sockets.in(room).emit('message', data);
    }
}

function sendToMe(socket, data) {
    io.sockets.in(socket.id).emit('message', data);
}

io.sockets.on('connection', function(socket) {
    // once a client has connected, we expect to get a ping from them saying what room they want to join
    socket.on('join_to_room', function(data) {

        try{
            var roomID = hashids.decode(data.room);
            var key = sha256(roomID+''+keySalt);
            var roomName = 'conversation-'+roomID;

            if (data.key == key) {
                socket.join(roomName, function () {
                    sendToMyRooms(socket, {
                        type:'new_user',
                        count:io.sockets.adapter.rooms[roomName].length
                    });

                });

            }else{
                sendToMe(socket,{type:'wrong_key'});
            }
        }catch(e){}
    });

    socket.on('message', function(data) {
        sendToMyRooms(socket, data);

    });
});



app.get('/db', function (request, response) {

    pool.query('SELECT * FROM test_table', function(err, result) {
        if (err)
        { console.error(err); response.send("Error " + err); }
        else
        { response.render('pages/db', {results: result.rows} ); }
    });

});


http.listen(port, function(){
    console.log('listening on *:' + port);
});
