
export const secureConferenceName = (name:string|undefined, prefix:string|undefined = undefined, _defaultPrefix:string = "cms") => {
  if(!name) throw Error("no Conference Name was provided")
  name = name.toLowerCase()
  name = name.replace(/[~`!@#$%^&*()+={}[\];:'"<>.,/\\?-_]/g, '');
  return prefix ? prefix + name : _defaultPrefix + name
}