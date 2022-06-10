import React, {ChangeEvent, Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useDropzone} from "react-dropzone";
import {createFFmpeg, fetchFile} from "@ffmpeg/ffmpeg";

import "./App.css";

function App() {
    const [videoURL, setVideoURL] = useState("");
    const [duration, setDuration] = useState(0);
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(0);
    const [rangeStart, setRangeStart] = React.useState(0);
    const [rangeEnd, setRangeEnd] = React.useState(0);
    const [mpegReady, setMpegReady] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [videoWidth, setVideoWidth] = React.useState(0);
    const [videoHeight, setVideoHeight] = React.useState(0);
    const [renderedVideo, setRenderedVideo] = React.useState<null | Blob>(null);
    const [fileName, setFileName] = React.useState("testVideo");
    const [videoFrame, setVideoFrame] = React.useState(0);
    const mpegLoaded = React.useRef<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const ffmpeg = useMemo(() => {
        return createFFmpeg({
            log: true,
            progress: ({ratio}) => setProgress(ratio)
        });
    }, []);
    useEffect(() => {
        if (videoRef.current && videoURL) {
            setVideoFrame(0);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setDuration(videoRef.current.duration);
                    setStart(0);
                    setEnd(videoRef.current.duration);
                    setRangeStart(0);
                    setRangeEnd(videoRef.current.duration);
                    setVideoWidth(videoRef.current.videoWidth);
                    setVideoHeight(videoRef.current.videoHeight);
                }
            }, 200);
        }
    }, [videoRef, videoURL]);
    useEffect(() => {
        if (!mpegLoaded.current && ffmpeg) {
            mpegLoaded.current = true;
            ffmpeg.load().then(() => {
                setMpegReady(true);
            });
        }
    }, [ffmpeg]);

    const handleDrop = async (files: File[]) => {
        const videos = files.filter(v => v.type.includes("video"));

        if (videos.length === 1) {
            const videoBlobURL = URL.createObjectURL(videos[0]);
            setVideoURL(videoBlobURL);
        } else if (videos.length > 1) {
            alert("you can upload file one by one at a time.")
        } else {
            alert("please upload video file. (wrong file type)")
        }
    }
    const handleRange = (e: ChangeEvent<HTMLInputElement>, type: "start" | "end") => {
        if (type === 'start') {
            const value = Math.min(Number(e.target.value), rangeEnd - 1);
            setRangeStart(value);
        } else {
            const value = Math.max(Number(e.target.value), rangeStart + 1);
            setRangeEnd(value);
        }
    }

    function timeFormatter(time: number, type?: "floor" | "ceil") {
        const hour = Math.floor(time / 3600);
        const minute = Math.floor(time / 60);
        const second = time % 60;

        if (type === undefined) {
            return `${hour}:${minute}:${second}`;
        }

        return `${hour}:${minute}:${type === "floor" ? Math.floor(second) : Math.ceil(second)}`;
    }

    function save(filename: string, data: Blob) {
        //@ts-ignore
        if (window.navigator.msSaveOrOpenBlob) {
            //@ts-ignore
            window.navigator.msSaveBlob(data, filename);
        } else {
            const elem = window.document.createElement('a');
            elem.href = window.URL.createObjectURL(data);
            elem.download = filename;
            document.body.appendChild(elem);
            elem.click();
            document.body.removeChild(elem);
        }
    }

    const handleRender = async () => {
        if (mpegReady) {
            const fetchedVideo = await fetchFile(videoURL);
            ffmpeg.FS('writeFile', "test.webm", fetchedVideo);
            await ffmpeg.run(
                '-ss', timeFormatter(rangeStart),
                '-i', 'test.webm',
                '-to', timeFormatter(rangeEnd),
                '-row-mt', '1',
                '-an',
                'test1.mp4'
            );
            const trimmedVideo = await ffmpeg.FS('readFile', "test1.mp4");
            setRenderedVideo(new Blob([trimmedVideo.buffer]));
        }
    }
    const handleDownload = async () => {
        if (renderedVideo) {
            if (fileName) {
                save(fileName + ".mp4", renderedVideo);
            } else {
                save(`test${JSON.stringify(Date.now())}.mp4`, renderedVideo);
            }
        }
    }
    const handleTestButton = async () => {
        if (mpegReady) {
            // @ts-ignore
            console.stdlog = console.log.bind(console);
            // @ts-ignore
            console.logs = [];
            console.log = function(){
                // @ts-ignore
                console.logs.push(Array.from(arguments));
                // @ts-ignore
                console.stdlog.apply(console, arguments);
            }

            // @ts-ignore
            console.logs.length = 0;
            const fetchedVideo = await fetchFile(videoURL);
            ffmpeg.FS('writeFile', "test.webm", fetchedVideo);
            await ffmpeg.run(
                '-i', 'test.webm',
            );

            setVideoFrame(
                // @ts-ignore
                parseFloat(/(\d*\.?\d* fps)/g.exec(console.logs.filter((v: string[]) => (v[0].includes("fps") && v[0].includes("Video")))[0])[0].replace(' fps', ''))
            );

            // @ts-ignore
            console.logs.length = 0;
            // console.clear();

            // @ts-ignore
            console.log = console.stdlog.bind(console);
            // @ts-ignore
            console.logs = undefined;
            // @ts-ignore
            console.stdlog = undefined;
        }
    };

    const {getRootProps} = useDropzone({onDrop: handleDrop});

    return (
        <div style={{width: "100vw", height: "100vh"}} {...getRootProps()}
             onClick={undefined}>
            <div>
                <b>browser side video slicing tool (use FFmpeg.wasm)</b>
            </div>
            <br/>
            <video ref={videoRef} style={{width: "600px", display: !!videoURL ? "unset" : "none"}} src={videoURL}
                // autoPlay={true}  loop={true}
                   controls
                   muted={true} playsInline={true}/>
            <div>
                <span>Please Drop Video</span><br/>
                <button onClick={getRootProps().onClick}>Find File</button>
            </div>
            {!!videoURL && mpegReady &&
                <Fragment>
                    <ul>
                        <li>videoWidth: {videoWidth}</li>
                        <li>videoHeight: {videoHeight}</li>
                        <br/>
                        <li>start: {start}</li>
                        <li>end: {end}</li>
                        <li>duration: {duration}</li>
                        <br/>
                        <li>rangeStart: {rangeStart}</li>
                        <li>rangeEnd: {rangeEnd}</li>
                        <li>rangeDuration: {(rangeEnd - rangeStart).toFixed(3)}</li>
                    </ul>
                    <div style={{width: "600px", height: "2px", backgroundColor: "black"}} className="slider">
                        <input type="range" min={start} max={end} step={0.001} value={rangeStart}
                               onChange={e => {
                                   handleRange(e, "start");
                                   setProgress(0);
                                   setRenderedVideo(null);
                               }}/>
                        <input type="range" min={start} max={end} step={0.001} value={rangeEnd}
                               onChange={e => {
                                   handleRange(e, "end");
                                   setProgress(0);
                                   setRenderedVideo(null);
                               }}/>
                    </div>
                    <br/>
                    <input style={{textAlign: "right"}}
                           value={fileName} onChange={e => setFileName(e.target.value)}/>
                    <span>.mp4</span>
                    <br/>
                    <button disabled={progress !== 0 && progress !== 1} onClick={handleRender}>
                        Render Video {progress > 0 && ` ${(progress * 100).toFixed(2)}%`}
                    </button>
                    {renderedVideo && progress === 1 && <button onClick={handleDownload}>
                        Download Video
                    </button>}<br/><br/>
                    <button onClick={handleTestButton}>
                        {videoFrame === 0 ? "getFrame" : `fps: ${videoFrame}`}
                    </button>
                    {videoFrame !== 0 && <span> range frame number: {Math.floor(videoFrame * (rangeEnd - rangeStart))}</span>}
                </Fragment>}
        </div>
    );
}

export default App;
