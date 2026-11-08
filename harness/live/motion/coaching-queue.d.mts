export type ReviewState = 'queued' | 'analyzing' | 'ready' | 'failed' | 'cancelled' | 'not-queued';
export function createCoachingQueue<Item extends {key:string}, Result, Prepared = undefined>(options:{
  review:(item:Item,signal:AbortSignal|undefined,prepared:Prepared)=>Promise<Result>;
  prepare?:(signal:AbortSignal|undefined)=>Promise<Prepared>;
  onState?:(item:Item,state:ReviewState,message:string)=>void;
  onResult?:(item:Item,result:Result)=>void;
  signal?:AbortSignal; maxReviews?:number; intervalMs?:number;
  now?:()=>number; schedule?:(callback:()=>void,delay:number)=>unknown; cancelTimer?:(handle:unknown)=>void;
}): {enqueue(item:Item):boolean;snapshot():{accepted:number;queued:number;running:number;cancelled:boolean};cancel():void};
