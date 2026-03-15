import React, { useCallback, useEffect, useState } from "react";
import { useConferenceStore } from "../../../../store/ConferenceStore";
import { NameTag } from "../../../NameTag/NameTag";
import {InputField} from '../../../common/Input/InputField'

export const NameContainer = () => {

  const [name, setName] = useState("Enter Your Name");
  const [isActive, setActive] = useState(false);
  const setDisplayName = useConferenceStore(store => store.setDisplayName)
  const displayName = useConferenceStore(store => store.displayName)
  const onClick = useCallback(() => {setActive(true);},[]);

  useEffect(()=>{
    setName(displayName)
  },[displayName])

  const onChange = (e) => {
    setName(e.target.value);
  };
  const onFocusLost = () => {
    setActive(false);
    setDisplayName(name)
  };

  if (isActive) {
    return (
      <InputContainer
        autoFocus
        onChange={onChange}
        close={onFocusLost}
        placeholder={name}
      />
    );
  } else {
    return <NameTag onClick={onClick}>{name}</NameTag>;
  }
};

const InputContainer = (props) => {
  const handleClose = useCallback(() => {
    props?.close();
  },[props]);

  useEffect(() => {
    document.addEventListener("keyup", (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        handleClose();
      }
    });
    return document.removeEventListener("keyup", (e) => {
      if (e.key === "Escape" || e.key === "Enter") handleClose();
    });
  }, [handleClose]);

  return <InputField {...props} onBlur={handleClose} />;
};
