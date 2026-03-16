export type JitsiMeetJSLike = any;
export type JitsiConnectionLike = any;
export type JitsiConferenceLike = any;
export type JitsiTrackLike = any;

declare global {
  interface Window {
    JitsiMeetJS?: JitsiMeetJSLike;
  }
}

