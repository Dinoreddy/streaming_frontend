import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const signalingServerUrl = 'wss://streaming-backend-xpvs.onrender.com';
const mlServerUrl = 'ws://192.168.113.171:3000'; // ML server URL

const StreamViewer = () => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [streams, setStreams] = useState([]);
  const ws = useRef(null); // WebSocket connection to signaling server
  const mlSocket = useRef(null); // WebSocket connection to ML server
  const streamRefs = useRef(new Map()); // Map to track streams and their IDs
  const videoRefs = useRef(new Map()); // Map to store video element refs
  const canvasRefs = useRef(new Map()); // Map to store canvas element refs

  // Function to connect to the ML server WebSocket
  const connectToMLServer = () => {
    if (mlSocket.current) {
      mlSocket.current.close();
    }
    mlSocket.current = new WebSocket(mlServerUrl);

    mlSocket.current.onopen = () => {
      console.log('[ML Server] Connected');
    };

    mlSocket.current.onerror = (error) => {
      console.error('[ML Server] WebSocket error:', error);
    };

    mlSocket.current.onclose = () => {
      console.log('[ML Server] Disconnected, retrying in 5 seconds...');
      setTimeout(connectToMLServer, 5000); // Retry after 5 seconds
    };

    mlSocket.current.onmessage = (event) => {
      console.log('[ML Server] Message received:', event.data);

      // Log the raw JSON data
      try {
        const jsonResponse = JSON.parse(event.data);
        console.log('[ML Server] JSON response:', jsonResponse);

        // You can log specific fields if needed, for example:
        const { type, result, streamId } = jsonResponse;

        if (type === 'processed_frame') {
          console.log(`[ML Server] Processed frame received for stream ID: ${streamId}`);
          console.log('[ML Server] ML result:', result); // Log the result (can be any data you expect in the JSON response)
        } else {
          console.warn('[ML Server] Unknown message type:', type);
        }
      } catch (e) {
        console.error('[ML Server] Error parsing JSON response:', e);
      }
    };
  };

  useEffect(() => {
    // Connect to the signaling server
    ws.current = new WebSocket(signalingServerUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.current.onmessage = (event) => {
      console.log('Signaling server message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('Signaling server parsed data:', data);

        const { type, peerId: incomingPeerId, streamId } = data;

        if (type === 'call' && peer) {
          console.log('Received call request from:', incomingPeerId);
          const call = peer.call(incomingPeerId, window.localStream);
          call.on('stream', remoteStream => {
            const streamId = remoteStream.id;
            if (!streamRefs.current.has(streamId)) {
              streamRefs.current.set(streamId, remoteStream);
              setStreams(prevStreams => [...prevStreams, remoteStream]);

              // Connect to ML server when a new stream is added
              if (!mlSocket.current) {
                connectToMLServer();
              }
            } else {
              console.log('Stream already added:', streamId);
            }
          });
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    // Create a new Peer instance
    const newPeer = new Peer(undefined, {
      host: 'streaming-backend-xpvs.onrender.com',
      port: 443,
      path: '/',
      secure: true
    });

    setPeer(newPeer);

    newPeer.on('open', id => {
      setPeerId(id);
      ws.current.send(JSON.stringify({ type: 'register', peerId: id }));
      console.log('Your Peer ID:', id);
    });

    newPeer.on('call', call => {
      console.log('Incoming call from:', call.peer);
      call.answer(); // Answer without sending a stream
      call.on('stream', remoteStream => {
        const streamId = remoteStream.id;
        if (!streamRefs.current.has(streamId)) {
          streamRefs.current.set(streamId, remoteStream);
          setStreams(prevStreams => [...prevStreams, remoteStream]);

          // Connect to ML server when a new stream is added
          if (!mlSocket.current) {
            connectToMLServer();
          }
        } else {
          console.log('Stream already added:', streamId);
        }
      });
    });

    // Get local media stream but do not display it
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        window.localStream = stream;
        console.log('Local stream obtained but not displayed.');
      });

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (mlSocket.current) {
        mlSocket.current.close();
      }
      if (peer) {
        peer.destroy();
      }
    };
  }, []);

  useEffect(() => {
    // Update video elements with streams
    streams.forEach((stream) => {
      const streamId = stream.id;
      const video = videoRefs.current.get(streamId);
      const canvas = canvasRefs.current.get(streamId);

      if (video && canvas) {
        video.srcObject = stream;

        const context = canvas.getContext('2d');
        
        const processVideo = () => {
          if (video && canvas) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const processedFrame = canvas.toDataURL('image/jpeg');
            if (mlSocket.current && mlSocket.current.readyState === WebSocket.OPEN) {
              try {
                mlSocket.current.send(JSON.stringify({
                  type: 'frame',
                  frame: processedFrame,
                  streamId: streamId
                }));
                console.log('Frame data sent to ML server for stream ID:', streamId);
              } catch (e) {
                console.error('Error sending frame to ML server:', e);
              }
            } else {
              console.warn('ML server WebSocket not open');
            }
          }
          setTimeout(processVideo, 1000 / 30); // 30 FPS
        };

        processVideo();
      }
    });
  }, [streams]);

  return (
    <div>
      <h1>Stream Viewer</h1>
      <h3>Your Peer ID: {peerId}</h3>
      {streams.map((stream) => (
        <div key={stream.id}>
          <video
            ref={el => videoRefs.current.set(stream.id, el)} // Assign ref to video elements
            autoPlay
            muted
          />
          <canvas
            ref={el => canvasRefs.current.set(stream.id, el)} // Assign ref to canvas elements
            style={{ display: 'none' }} // Hide canvas elements
          />
        </div>
      ))}
    </div>
  );
};

export default StreamViewer;
