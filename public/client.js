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
  let data;

  try {
    data = JSON.parse(event.data);
  } catch (e) {
    console.log('invalid json');
    data = {};
  }

  console.log('signaling server message: ', data);

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

function sendToPeer(message) {
  if (name) {
    message.sender = name;
  }
  dataChannels[message.receiver].channel.send(JSON.stringify(message));
}

function handleLogin(success) {
  if(success === false) {
    alert('username already in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';
  }
};

function getRtcPC(peer) {
  console.log('GETTING RTCPC FROM GETRTCPC');
  let configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    let newRtcPeerConn = new RTCPeerConnection(configuration);

    newRtcPeerConn.onicecandidate = (event) => {
      if(event.candidate) {
        console.log('SENDING CANDIDATE VIA SERVER!');
        send({
          type: 'candidate',
          candidate: event.candidate,
          receiver: peer
        });
      };
    };

    newRtcPeerConn.ondatachannel = (event) => {
      dataChannels[peer] = { channel: event.channel };

      // relay coding start

      if(Object.keys(dataChannels).length > 1) {
        for(let channel in dataChannels) {
          // console.log('channel.label: ', dataChannels[channel].channel.label);
          if(dataChannels[peer].channel.label !== dataChannels[channel].channel.label) {
            // console.log('relay ', dataChannels[peer].channel.label, ' to ', dataChannels[channel].channel.label);
            sendToPeer({
              type: 'discovery',
              peer: dataChannels[peer].channel.label,
              receiver: dataChannels[channel].channel.label
            })
          }
        };
      };

      // relay coding end
    };

    openDataChannel(newRtcPeerConn, peer);

    newRtcPeerConn.oniceconnectionstatechange = () => {
      console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    };

    return newRtcPeerConn;
};

function handleDiscovery(peer, sender) {
  if(!dataChannels[peer]) {
    console.log('peer: ', peer, ' not found');
    // sendToPeer({
    //   type: 'relay',
    //   relay: 'offer',
    //   receiver: sender,
    //   offer: 'offer from ' + name, // TODO: create offer; createOffer(peer, true);
    //   peer: peer
    // });

    // inserting offer creation

    // inserting peer connection creation
    let configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    let newRtcPeerConn = new RTCPeerConnection(configuration);

    newRtcPeerConn.onicecandidate = (event) => {
      if(event.candidate) {
        sendToPeer({
          type: 'relay',
          relay: 'candidate',
          candidate: event.candidate,
          receiver: sender,
          peer: peer
        });
      };
    };

    newRtcPeerConn.ondatachannel = (event) => {
      dataChannels[peer] = { channel: event.channel };

      // relay coding start

      // if(Object.keys(dataChannels).length > 1) {
      //   for(let channel in dataChannels) {
      //     // console.log('channel.label: ', dataChannels[channel].channel.label);
      //     if(dataChannels[peer].channel.label !== dataChannels[channel].channel.label) {
      //       // console.log('relay ', dataChannels[peer].channel.label, ' to ', dataChannels[channel].channel.label);
      //       sendToPeer({
      //         type: 'discovery',
      //         peer: dataChannels[peer].channel.label,
      //         receiver: dataChannels[channel].channel.label
      //       })
      //     }
      //   };
      // };

      // relay coding end
    };

    openDataChannel(newRtcPeerConn, peer);

    newRtcPeerConn.oniceconnectionstatechange = () => {
      console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    };
    // end peer connection insertions

    newRtcPeerConn.createOffer((offer) => {
      newRtcPeerConn.setLocalDescription(offer);
      sendToPeer({
        type: 'relay',
        relay: 'offer',
        offer: offer,
        receiver: sender,
        peer: peer
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });

    rtcPeerConns[peer] = { conn: newRtcPeerConn };
    // end insert offer
  };
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

function handlePeerOffer(offer, sender, peer) {

  // let offerRtcPeerConn = getRtcPC(peer);
  // INSERT GETRTCPC CODE
  let configuration = {
    'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
  };

  let offerRtcPeerConn = new RTCPeerConnection(configuration);

  offerRtcPeerConn.onicecandidate = (event) => {
    if(event.candidate) {
      sendToPeer({
        type: 'relay',
        relay: 'candidate',
        candidate: event.candidate,
        receiver: sender,
        peer: peer
      });
    };
  };

  offerRtcPeerConn.ondatachannel = (event) => {
    dataChannels[peer] = { channel: event.channel };

    // relay coding start

    // if(Object.keys(dataChannels).length > 1) {
    //   for(let channel in dataChannels) {
    //     // console.log('channel.label: ', dataChannels[channel].channel.label);
    //     if(dataChannels[peer].channel.label !== dataChannels[channel].channel.label) {
    //       // console.log('relay ', dataChannels[peer].channel.label, ' to ', dataChannels[channel].channel.label);
    //       sendToPeer({
    //         type: 'discovery',
    //         peer: dataChannels[peer].channel.label,
    //         receiver: dataChannels[channel].channel.label
    //       })
    //     }
    //   };
    // };

    // relay coding end
  };

  openDataChannel(offerRtcPeerConn, peer);

  offerRtcPeerConn.oniceconnectionstatechange = () => {
    console.log('ICE connection state change: ', offerRtcPeerConn.iceConnectionState);
  };

  // END INSERT GETRTCPC CODE

  offerRtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));

  offerRtcPeerConn.createAnswer((answer) => {
    offerRtcPeerConn.setLocalDescription(answer);
    sendToPeer({
      type: 'relay',
      relay: 'answer',
      answer: answer,
      receiver: sender,
      peer: peer
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

  rtcPeerConns[peer] = { conn: offerRtcPeerConn };
};

function handleAnswer(answer, senderName) {
  let answerPeerConn = rtcPeerConns[senderName].conn
  answerPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, senderName) {
  let candPeerConn = rtcPeerConns[senderName].conn
  candPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function handleRelay(data) {
  let message = {}

  switch(data.relay) {
    case 'offer':
      message.type = 'offer';
      message.offer = data.offer;
      break;
    case 'answer':
      message.type = 'answer';
      message.answer = data.answer;
      break;
    case 'candidate':
      message.type = 'candidate';
      message.candidate = data.candidate;
      break;
    default:
      break;
  }

  message.peer = data.sender;
  message.receiver = data.peer;

  sendToPeer(message);
}

function openDataChannel(peerConn, openName) {
  newDataChannel = peerConn.createDataChannel(name, {reliable: true});
  
  console.log('data channel created: ', newDataChannel);

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  /*
   *  data channel peer routing
   */
  newDataChannel.onmessage = (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.log('invalid json');
      data = {};
    }

    console.log('peer message: ', data);

    switch(data.type) {
      case 'message':
        chatArea.innerHTML += data.sender + ': ' + data.message + '<br />';
        break;
      case 'discovery':
        console.log('discovery: ', data);
        handleDiscovery(data.peer, data.sender);
        break;
      case 'relay':
        console.log('relay: ', data);
        handleRelay(data);
        break;
      case 'offer':
        console.log('offer from peer route, call handlePeerOffer()');
        handlePeerOffer(data.offer, data.sender, data.peer);
        break;
      case 'answer':
        console.log('answer from peer route, call handleAnswer()');
        handleAnswer(data.answer, data.peer);
        break;
      case 'candidate':
        console.log('candidate from peer route, call handleCandidate()');
        handleCandidate(data.candidate, data.peer);
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
 *  peer to peer
 */



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

    rtcPeerConns[receiver] = { conn: newRtcPeerConn };
  };
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