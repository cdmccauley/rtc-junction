// username
let name;
let connectedUser;

// connecting to signal server (code from heroku instead of tutorial)
let HOST = location.origin.replace(/^http/, 'ws');
let conn = new WebSocket(HOST);

conn.onopen = () => {
  console.log('Connected to the signaling server');
};

// when we got a message from a signaling server
conn.onmessage = (msg) => {
  console.log('Got message: ', msg.data);

  let data = JSON.parse(msg.data);

  switch(data.type) {
    case 'login':
      handleLogin(data.success);
      break;
    // on call
    case 'offer':
      handleOffer(data.offer, data.name);
      break;
    case 'answer':
      handleAnswer(data.answer);
      break;
    // when a remote peer sends an ice candidate
    case 'candidate':
      handleCandidate(data.candidate);
      break;
    case 'leave':
      handleLeave();
      break;
    default:
      break;
  }
};

conn.onerror = (err) => {
  console.log("Error: ", err);
};

// alias for sending JSON messages
function send(message) {
  // attach the other peer username to messages
  if (connectedUser) {
    message.name = connectedUser;
  }

  conn.send(JSON.stringify(message));
};