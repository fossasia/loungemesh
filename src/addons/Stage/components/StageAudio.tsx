import { useEffect, useRef } from "react";

//Could be a general Audio Element for all other components
export const AudioComponent:React.FunctionComponent<{audio:IAudioTrack | undefined, volume:number, className?:string, id?:string}> = ({ audio, volume, className, id }) => {

	const myRef: any = useRef();

	useEffect(() => {
		if (myRef.current && myRef.current.volume !== undefined)
			myRef.current.volume = volume;
	}, [volume]);

	useEffect(() => {
		const currentEl = myRef.current;
		let tmpEl = undefined;
		if (audio?.containers && audio?.containers.length > 0) {
			tmpEl = audio.containers[0];
			if(tmpEl) audio.detach(tmpEl);
		}
		if (audio?.containers.length === 0)
			audio?.attach(currentEl);
		return (() => {
			audio?.detach(currentEl);
			if (tmpEl)
				audio?.attach(tmpEl);
		});
	},[audio]);

	return <audio autoPlay={true} ref={myRef} className={className} id={id} />;
};
