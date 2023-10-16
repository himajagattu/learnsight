import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import classnames from 'classnames';
import _ from 'lodash';
import { RouteComponentProps } from 'react-router-dom';
import ZoomContext from '../../context/zoom-context';
import ZoomMediaContext from '../../context/media-context';
import Avatar from './components/avatar';
import VideoFooter from './components/video-footer';
import Pagination from './components/pagination';
import { useCanvasDimension } from './hooks/useCanvasDimension';
import { useGalleryLayout } from './hooks/useGalleryLayout';
import { usePagination } from './hooks/usePagination';
import { useActiveVideo } from './hooks/useAvtiveVideo';
import { useShare } from './hooks/useShare';
import { useLocalVolume } from './hooks/useLocalVolume';
import './video.scss';
import { isShallowEqual } from '../../utils/util';
import { useSizeCallback } from '../../hooks/useSizeCallback';
import { useAdvancedFeatureSwitch } from './hooks/useAdvancedFeatureSwith';
import RemoteControlPanel, { RemoteControlIndication } from './components/remote-control';
import { useCameraControl } from './hooks/useCameraControl';
import { useNetworkQuality } from './hooks/useNetworkQuality';
import ReportBtn from './components/report-btn';
const VideoContainer: React.FunctionComponent<RouteComponentProps> = (props) => {
  const zmClient = useContext(ZoomContext);
  const {
    mediaStream,
    video: { decode: isVideoDecodeReady }
  } = useContext(ZoomMediaContext);
  const videoRef = useRef<HTMLCanvasElement | null>(null);
  const shareRef = useRef<HTMLCanvasElement | null>(null);
  const selfShareRef = useRef<(HTMLCanvasElement & HTMLVideoElement) | null>(null);
  const shareContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerDimension, setContainerDimension] = useState({
    width: 0,
    height: 0
  });
  const [shareViewDimension, setShareViewDimension] = useState({
    width: 0,
    height: 0
  });
  const canvasDimension = useCanvasDimension(mediaStream, videoRef);
  const activeVideo = useActiveVideo(zmClient);
  const { page, pageSize, totalPage, totalSize, setPage } = usePagination(zmClient, canvasDimension);
  const { visibleParticipants, layout: videoLayout } = useGalleryLayout(
    zmClient,
    mediaStream,
    isVideoDecodeReady,
    videoRef,
    canvasDimension,
    {
      page,
      pageSize,
      totalPage,
      totalSize
    }
  );
  const { isRecieveSharing, isStartedShare, sharedContentDimension } = useShare(zmClient, mediaStream, shareRef);

  const { userVolumeList, setLocalVolume } = useLocalVolume();
  const {
    isControllingFarEnd,
    currentControlledUser,
    isInControl,
    giveUpControl,
    stopControl,
    turnDown,
    turnRight,
    turnLeft,
    turnUp,
    zoomIn,
    zoomOut,
    switchCamera
  } = useCameraControl(zmClient, mediaStream);

  const { advancedSwitch, toggleAdjustVolume, toggleFarEndCameraControl } = useAdvancedFeatureSwitch(
    zmClient,
    mediaStream,
    visibleParticipants
  );
  const networkQuality = useNetworkQuality(zmClient);

  const isSharing = isRecieveSharing || isStartedShare;
  useEffect(() => {
    if (isSharing && shareContainerRef.current) {
      const { width, height } = sharedContentDimension;
      const { width: containerWidth, height: containerHeight } = containerDimension;
      const ratio = Math.min(containerWidth / width, containerHeight / height, 1);
      setShareViewDimension({
        width: Math.floor(width * ratio),
        height: Math.floor(height * ratio)
      });
    }
  }, [isSharing, sharedContentDimension, containerDimension]);

  const onShareContainerResize = useCallback(({ width, height }) => {
    _.throttle(() => {
      setContainerDimension({ width, height });
    }, 50)();
  }, []);
  useSizeCallback(shareContainerRef.current, onShareContainerResize);
  useEffect(() => {
    if (!isShallowEqual(shareViewDimension, sharedContentDimension)) {
      mediaStream?.updateSharingCanvasDimension(shareViewDimension.width, shareViewDimension.height);
    }
  }, [mediaStream, sharedContentDimension, shareViewDimension]);
  const onAdvancedFeatureToggle = useCallback(
    (userId: number, key: string) => {
      if (key === 'volume') {
        toggleAdjustVolume(userId);
      } else if (key === 'farend') {
        if (isControllingFarEnd) {
          giveUpControl();
        } else {
          mediaStream?.requestFarEndCameraControl(userId);
        }
        // toggleFarEndCameraControl(userId);
      }
    },
    [toggleAdjustVolume, giveUpControl, mediaStream, isControllingFarEnd]
  );
  return (
    
    <div className="viewport">
      <div
        className={classnames('share-container', {
          'in-sharing': isSharing
        })}
        ref={shareContainerRef}
      >
        <div
          className="share-container-viewport"
          style={{
            width: `${shareViewDimension.width}px`,
            height: `${shareViewDimension.height}px`
          }}
        >
          <canvas className={classnames('share-canvas', { hidden: isStartedShare })} ref={shareRef} />
          {mediaStream?.isStartShareScreenWithVideoElement() ? (
            <video
              className={classnames('share-canvas', {
                hidden: isRecieveSharing
              })}
              ref={selfShareRef}
            />
          ) : (
            <canvas
              className={classnames('share-canvas', {
                hidden: isRecieveSharing
              })}
              ref={selfShareRef}
            />
          )}
        </div>
      </div>
      <div
        className={classnames('video-container', {
          'in-sharing': isSharing
        })}
      >
        <canvas className="video-canvas" id="video-canvas" width="800" height="600" ref={videoRef} />
        <ul className="avatar-list">
          {visibleParticipants.map((user, index) => {
            if (index > videoLayout.length - 1) {
              return null;
            }
            const dimension = videoLayout[index];
            const { width, height, x, y } = dimension;
            const { height: canvasHeight } = canvasDimension;
            return (
              <Avatar
                participant={user}
                key={user.userId}
                isActive={activeVideo === user.userId}
                volume={userVolumeList.find((u) => u.userId === user.userId)?.volume}
                setLocalVolume={setLocalVolume}
                advancedFeature={advancedSwitch[`${user.userId}`]}
                onAdvancedFeatureToggle={onAdvancedFeatureToggle}
                isUserCameraControlled={isControllingFarEnd}
                networkQuality={networkQuality[`${user.userId}`]}
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                  top: `${canvasHeight - y - height}px`,
                  left: `${x}px`
                }}
              />
            );
          })}
        </ul>
      </div>
      {/* <VideoFooter className="video-operations" sharing shareRef={selfShareRef} /> */}
      {isControllingFarEnd && (
        <RemoteControlPanel
          turnDown={turnDown}
          turnLeft={turnLeft}
          turnRight={turnRight}
          turnUp={turnUp}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          switchCamera={switchCamera}
          controlledName={currentControlledUser.displayName}
        />
      )}
      {isInControl && <RemoteControlIndication stopCameraControl={stopControl} />}
      {/* {totalPage > 1 && <Pagination page={page} totalPage={totalPage} setPage={setPage} inSharing={isSharing} />} */}
      <ReportBtn />
    </div>
  );
};

export default VideoContainer;


// import React, {useState, useContext, useCallback} from 'react';
// import {Button, Tooltip} from 'antd';
// import { AudioOutlined, AudioMutedOutlined, VideoCameraAddOutlined, VideoCameraOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
// import { IconFont } from '../../component/icon-font';
// import ZoomContext from '../../context/zoom-context';
// //import MediaContext from 'antd/lib/menu/MenuContext';
// import './video.scss';
// import MediaContext from '../../context/media-context';


// const VideoContainer = () => {
//   const [videoStarted, setVideoStarted] = useState(false);
//   const [audioStarted, setAudioStarted] = useState(false);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isShareScreen, setIsShareScreen] = useState(false);
//   const [isSAB, setIsSAB] = useState(false);

//   const client = useContext(ZoomContext);
//   const mediaStream = useContext(MediaContext);

//   const isSupportWebCodes = () => {
//     return typeof window.MediaStreamTrackProcess === 'function';
//   }

//   const startVideoButton = useCallback(async () => {
//     if(!videoStarted){
//       if(!!window.chrome && !(typeof SharedArrayBuffer === 'function')) {
//         setIsSAB(false);
//         await mediaStream.startVideo({videoElement: document.querySelector('#self-view-video')})
//       }
//       else{
//         setIsSAB(true);
//         await mediaStream.startVideo();
//         mediaStream.renderVideo(document.querySelector('#self-view-canvas'), client.getCurrentUserInfo().userId, 1920, 1080, 0 ,0,3)
//       }
//       setVideoStarted(true)
//     }
//     else{
//       await mediaStream.stopVideo();
//       if(isSAB) {
//         mediaStream.stopRenderVideo(document.querySelector('#self-view-canvas'), client.getCurrentUserInfo().userId)
//       }
//       setVideoStarted(false);
//     }

//   },[mediaStream, videoStarted, client, isSAB])

//   const startAudiobutton = useCallback(async () =>{
//     if(audioStarted) {
//       if(isMuted){
//        await mediaStream.unmuteAudio();
//         setIsMuted(false)
//       }
//       else{
//        await mediaStream.muteAudio();
//        setIsMuted(true);
//       }
//     }
//     else{
//       await mediaStream.startAudio();
//       setAudioStarted(true);
//     }
//   },[mediaStream, audioStarted, isMuted])

//   const shareScreen = useCallback(async () => {
//     if(isShareScreen) {
//       await mediaStream.stopSharescreen();
//       setIsShareScreen(false)
//     }else{
//       if(isSupportWebCodes()){
//         await mediaStream.startShareScreen(document.querySelector('#share-video'))
//       }
//       else {
//         await mediaStream.startShareScreen(document.querySelector('share-canavas'))
//       }
//     }
//   },[isShareScreen, mediaStream])

//   return (
//     <div>
//       {isSAB ? 
//       <canvas id = "self-view-canvas" width='1920' height="1080"></canvas> :
//       <video id ="self-view-video" width ="1920" height="1080"></video>
//     }
//     { !isSupportWebCodes() ? 
//       <canvas id="share-canvas" width='1920' height="1080"></canvas> :
//       <video id = "share-video" width='1920' height="1080"></video>

//     }
//     <div className='video-footer'>
//       <Tooltip title={`${videoStarted ? 'stop Camera' : 'start camera'}`}>
//         <Button
//           className='camera-button'
//           icon={videoStarted ? <VideoCameraOutlined /> : <VideoCameraAddOutlined/>} 
//           shape = 'circle'
//           size='large'
//           onClick={startVideoButton}
//           />
//       </Tooltip>
//       <Tooltip title={`${videoStarted ? 'stop Camera' : 'start camera'}`}>
//         <Button
//           className='camera-button'
//           icon={videoStarted ? <VideoCameraOutlined /> : <VideoCameraAddOutlined/>} 
//           shape = 'circle'
//           size='large'
//           onClick={startVideoButton}
//           />
//       </Tooltip>
//       <Tooltip title={`${!isShareScreen ? 'share screen' : 'stop share'}`}>
//         <Button
//           className='camera-button'
//           icon={isShareScreen ? <FullscreenOutlined /> : <FullscreenExitOutlined/>} 
//           shape = 'circle'
//           size='large'
//           onClick={shareScreen}
//           />
//       </Tooltip>
//     </div>
//     </div>
//   )
// }

// export default VideoContainer;