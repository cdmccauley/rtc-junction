/*
 *  connect to signaling server
 */
let HOST = location.origin.replace(/^http/, 'ws')
let signalingServer = new WebSocket(HOST);

signalingServer.onopen = () => {
  console.log('connection to signaling server established');
}

/*
 *  signaling server routing
 */
signalingServer.onmessage = (event) => {
  console.log('signaling server message: ', event.data);

  let data = JSON.parse(event.data);

  switch(data.type) {
    case 'login':
      handleLogin(data.success);
      break;
    case 'offer':
      handleOffer(data.offer, data.sender);
      break;
    case 'answer':
      handleAnswer(data.answer, data.sender);
      break;
    case 'candidate':
      handleCandidate(data.candidate, data.sender);
      break;
    case 'leave':
      handleLeave();
      break;
    // case 'log':
    //   console.log(data.message);
    default:
      break;
  }
};

signalingServer.onerror = (err) => {
  console.log('error: ', err);
};

signalingServer.onclose = () => {
  console.log('connection to signaling server lost');
};

/*
 *  functions
 */
let name;

let rtcPeerConns = {};
let dataChannels = {};

function send(message) {
  if (name) {
    message.sender = name;
  }
  signalingServer.send(JSON.stringify(message));
};

function handleLogin(success) {
  if(success === false) {
    alert('username already in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';
  }
};

function getRtcPC(peer) {
  let configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    let newRtcPeerConn = new RTCPeerConnection(configuration);

    newRtcPeerConn.onicecandidate = (event) => {
      console.log('onicecandidate');
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
          receiver: peer
        });
      };
    };

    newRtcPeerConn.ondatachannel = (event) => {
      dataChannels[peer] = { channel: event.channel };
    };

    openDataChannel(newRtcPeerConn, peer);

    newRtcPeerConn.oniceconnectionstatechange = () => {
      console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    };

    return newRtcPeerConn;
};

function handleOffer(offer, name) {
  let sender = name;

  let offerRtcPeerConn = getRtcPC(sender);

  offerRtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));

  offerRtcPeerConn.createAnswer((answer) => {
    offerRtcPeerConn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer,
      receiver: sender
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

  rtcPeerConns[sender] = { conn: offerRtcPeerConn };
};

function handleAnswer(answer, senderName) {
  let answerPeerConn = rtcPeerConns[senderName].conn
  answerPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, senderName) {
  let candPeerConn = rtcPeerConns[senderName].conn
  candPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function openDataChannel(peerConn, openName) {
  newDataChannel = peerConn.createDataChannel(openName, {reliable: true});
  
  console.log('data channel created: ', newDataChannel);

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  /*
   *  data channel peer routing
   */
  newDataChannel.onmessage = (event) => {
    console.log('new message received: ', event.data);

    let data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'message':
        chatArea.innerHTML += data.sender + ': ' + data.message + '<br />';
        break;
      case 'relay':
        break;
      default:
        break;
    };
  };

  newDataChannel.onopen = (event) => {
    console.log('datachannel open');
    newDataChannel.established = new Date();
  }

  newDataChannel.onclose = (event) => {
    console.log('datachannel closed (duration: ', new Date() - newDataChannel.established, 'ms)');
  };

  dataChannels[openName] = { channel: newDataChannel };
  
};

function handleLeave() {
  // peerName = null;
  // rtcPeerConn.close();
  // rtcPeerConn.onicecandidate = null;
  console.log('TODO: handleLeave()');
};

/*
 *  user interface
 */

let loginPage = document.querySelector('#loginPage');
let usernameInput = document.querySelector('#usernameInput');
let loginBtn = document.querySelector('#loginBtn');

let callPage = document.querySelector('#callPage');
let callToUsernameInput = document.querySelector('#callToUsernameInput');
let callBtn = document.querySelector('#callBtn');

let hangUpBtn = document.querySelector('#hangUpBtn');
let msgInput = document.querySelector('#msgInput');
let sendMsgBtn = document.querySelector('#sendMsgBtn');

let chatArea = document.querySelector('#chatarea');

callPage.style.display = 'none';

loginBtn.addEventListener('click', (event) => {
  name = usernameInput.value;

  if(name.length > 0) {
    send({
      type: 'login',
    });
  };
});

callBtn.addEventListener('click', () => {
  let receiver = callToUsernameInput.value;

  if(receiver.length > 0) {

    let newRtcPeerConn = getRtcPC(receiver);

    console.log('pre-offer newRtcPeerConn: ', newRtcPeerConn);

    newRtcPeerConn.createOffer((offer) => {
      newRtcPeerConn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer,
        receiver: receiver
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });

    console.log('post-offer newRtcPeerConn: ', newRtcPeerConn);

    rtcPeerConns[receiver] = { conn: newRtcPeerConn };
  }
});

hangUpBtn.addEventListener('click', () => {
  send({
    type: 'leave'
  });
  handleLeave();
});

sendMsgBtn.addEventListener('click', (event) => {
  let val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  for(let channel in dataChannels) {
    dataChannels[channel].channel.send(JSON.stringify({
      type: 'message',
      sender: name,
      message: val
    }))
  };
  msgInput.value = '';
});