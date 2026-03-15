
export type StoreSetter<T> = (setter:(state:T)=>T)=>void