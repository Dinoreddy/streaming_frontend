import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const signalingServerUrl = 'wss://streaming-backend-xpvs.onrender.com';


const StreamComponent = () => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const myVideo = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(signalingServerUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connection established with signaling server');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error with signaling server:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed with signaling server');
    };

    const newPeer = new Peer(undefined, {
      host: 'streaming-backend-xpvs.onrender.com',
      port: 443,
      path: '/peerjs'
    });

    setPeer(newPeer);

    newPeer.on('open', id => {
      setPeerId(id);
      console.log('PeerJS connection opened with ID:', id);
      ws.current.send(JSON.stringify({ type: 'register', peerId: id }));
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        window.localStream = stream;
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      })
      .catch(error => {
        console.error('Error accessing media devices:', error);
      });

    return () => {
      ws.current.close();
      newPeer.destroy();
    };
  }, []);

  const callPeer = () => {
    if (!remotePeerId || !peer) {
      console.error('Remote Peer ID or PeerJS instance is not set');
      return;
    }
    const call = peer.call(remotePeerId, window.localStream);
    ws.current.send(JSON.stringify({ type: 'call', targetPeerId: remotePeerId }));
    console.log('Calling peer with ID:', remotePeerId);
  };

  return (
    <div>
      <h1>Call Peer</h1>
      <video ref={myVideo} autoPlay muted />
      <p>Your Peer ID: <strong>{peerId}</strong></p>
      <input 
        type="text" 
        placeholder="Enter Peer ID to connect" 
        value={remotePeerId}
        onChange={(e) => setRemotePeerId(e.target.value)} 
      />
      <button onClick={callPeer}>Call Peer</button>
    </div>
  );
};

export default StreamComponent;
