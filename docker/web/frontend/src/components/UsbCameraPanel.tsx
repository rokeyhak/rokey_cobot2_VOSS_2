import { useEffect, useRef, useState } from 'react';

const CAMERA_NAME = 'C270 HD WEBCAM';

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '카메라 권한이 차단됐습니다. 브라우저에서 카메라 접근을 허용해 주세요.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'C270 HD WEBCAM을 찾을 수 없습니다. USB 연결을 확인해 주세요.';
    if (error.name === 'NotReadableError' || error.name === 'AbortError') return 'C270 HD WEBCAM을 열 수 없습니다. 다른 앱이 사용 중인지 확인해 주세요.';
  }
  return '영상을 표시할 수 없습니다. C270 HD WEBCAM 연결을 확인해 주세요.';
}

/** 선택한 Web PC C270 영상만 표시한다. 마이크는 요청하지 않는다. */
export function UsbCameraPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [selected, setSelected] = useState('c270');
  const [showC270, setShowC270] = useState(false);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState(`${CAMERA_NAME} 연결 중`);

  useEffect(() => {
    let active = true;
    let request = 0;
    const media = navigator.mediaDevices;

    function releaseStream() {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
    }

    async function refreshDevices() {
      if (!window.isSecureContext || !media?.enumerateDevices) {
        if (active) {
          setShowC270(false);
          setMessage('카메라 사용에는 Web PC의 localhost 또는 HTTPS 주소가 필요합니다.');
        }
        return;
      }
      try {
        const cameras = (await media.enumerateDevices()).filter(device => device.kind === 'videoinput');
        if (active) {
          const available = cameras.some(device => /\bc270\b/i.test(device.label) || !device.label);
          setShowC270(available);
          if (!selected && !available) setMessage(`${CAMERA_NAME}을 찾을 수 없습니다. USB 연결을 확인해 주세요.`);
        }
      } catch {
        if (active) setShowC270(false);
      }
    }

    async function connect() {
      const id = ++request;
      if (!window.isSecureContext || !media?.getUserMedia) {
        setMessage('카메라 자동 연결에는 Web PC의 localhost 또는 HTTPS 주소가 필요합니다.');
        return;
      }
      try {
        let cameras = (await media.enumerateDevices()).filter(device => device.kind === 'videoinput');
        let camera = cameras.find(device => /\bc270\b/i.test(device.label));

        // 최초 권한 허용 전에는 장치 이름이 비어 있을 수 있다. 임시 스트림은 화면에 표시하지 않는다.
        if (!camera && cameras.some(device => !device.label)) {
          const permissionStream = await media.getUserMedia({ audio: false, video: true });
          permissionStream.getTracks().forEach(track => track.stop());
          if (!active || id !== request) return;
          cameras = (await media.enumerateDevices()).filter(device => device.kind === 'videoinput');
          camera = cameras.find(device => /\bc270\b/i.test(device.label));
          setShowC270(Boolean(camera));
        }
        if (!active || id !== request) return;
        if (!camera) {
          releaseStream();
          setLive(false);
          setMessage(`${CAMERA_NAME}을 찾을 수 없습니다. USB 연결을 확인해 주세요.`);
          return;
        }
        const currentTrack = stream.current?.getVideoTracks()[0];
        if (currentTrack?.readyState === 'live' && currentTrack.getSettings().deviceId === camera.deviceId) return;

        releaseStream();
        setLive(false);
        setMessage(`${CAMERA_NAME} 연결 중`);
        const next = await media.getUserMedia({
          audio: false,
          video: { deviceId: { exact: camera.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active || id !== request) {
          next.getTracks().forEach(track => track.stop());
          return;
        }
        stream.current = next;
        const track = next.getVideoTracks()[0];
        track.addEventListener('ended', () => {
          if (!active || stream.current !== next) return;
          releaseStream();
          setLive(false);
          setMessage(`${CAMERA_NAME} 연결이 끊겼습니다. 다시 연결을 시도합니다.`);
          void connect();
        }, { once: true });
        if (video.current) {
          video.current.srcObject = next;
          await video.current.play();
        }
        if (!active || id !== request) return;
        setLive(true);
        setMessage(track.label || CAMERA_NAME);
      } catch (error) {
        if (!active || id !== request) return;
        releaseStream();
        setLive(false);
        setMessage(cameraError(error));
      }
    }

    void refreshDevices();
    if (selected === 'c270') void connect();
    const onDeviceChange = () => {
      void refreshDevices();
      if (selected === 'c270' && stream.current?.getVideoTracks()[0]?.readyState !== 'live') void connect();
    };
    media?.addEventListener('devicechange', onDeviceChange);
    return () => {
      active = false;
      request += 1;
      media?.removeEventListener('devicechange', onDeviceChange);
      releaseStream();
    };
  }, [selected]);

  return <section className="panel camera-panel">
    <div className="section-heading"><div><span className="eyebrow">CAMERA / WEB PC</span><h2>{CAMERA_NAME}</h2></div><span className={`chip ${live ? '' : 'warning'}`}>{live ? 'LIVE' : 'OFFLINE'}</span></div>
    <div className="camera-preview">
      <video ref={video} muted playsInline aria-label={`${CAMERA_NAME} 실시간 영상`} />
      {!live && <span role="status">{message}</span>}
    </div>
    <div className="field camera-device-field">
      <label htmlFor="usb-camera">USB 카메라</label>
      <div className="inline-input"><select id="usb-camera" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">카메라 선택</option>
        {(showC270 || selected === 'c270') && <option value="c270">{CAMERA_NAME}</option>}
      </select></div>
    </div>
  </section>;
}
