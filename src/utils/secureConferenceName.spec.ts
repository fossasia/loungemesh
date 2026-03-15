/**
 * it should prefix the name if a prefix is set
 * else it should add cms as prefix (short for ChatMoSphere)
 * it should make sure its lower case
 * it should make sure its only strings and numbers (no symbols/code)
 */

import { secureConferenceName } from "./secureConferenceName"


const defaultPrefix = "cms"
const prefix = "intern1245"
const sessionName = "chatmosphere"

it('should add a prefix if prefix is set', () => {
  expect(secureConferenceName(sessionName, prefix)).toEqual(prefix+sessionName)
  const envPrefix = process.env.REACT_APP_SESSION_PREFIX || defaultPrefix
  expect(secureConferenceName(sessionName, process.env.REACT_APP_SESSION_PREFIX)).toBe(envPrefix + sessionName)
})

it('should add cms as prefix if no prefix was set', () => {
  expect(secureConferenceName(sessionName)).toEqual(defaultPrefix + sessionName)
})

it('should make sessionName lowerCase', () => {
  const name = "MyTestSession"
  expect(secureConferenceName(name)).toEqual(defaultPrefix + name.toLowerCase())
})

it('should only be strings and numbers', ()=>{
  const name = "<script>alert(\"Alert1000\")</script>"
  expect(secureConferenceName(name)).toEqual(defaultPrefix + "scriptalertalert1000script")
})
it('should throw error if empty', () =>{
  expect(() => secureConferenceName(undefined)).toThrow()
})