import {chatGPTProvider} from '../provider/client.mjs';
export function mountCoachConnection(host:HTMLElement,options?:{provider?:typeof chatGPTProvider;onState?:(state:string)=>void;onDisconnect?:()=>void}):()=>void;
