export function secureConferenceName(
  name: string | undefined,
  prefix: string | undefined = undefined,
  defaultPrefix = 'fls'
): string {
  if (!name) throw new Error('no Conference Name was provided');
  let n = name.toLowerCase();
  n = n.replace(/[~`!@#$%^&*()+={}[\];:'"<>.,/\\?-_]/g, '');
  return prefix ? prefix + n : defaultPrefix + n;
}
