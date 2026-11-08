import type {AnalysisReport, AnalysisProgress} from '../motion/analyze.mjs';
import type {getSession} from './index.mjs';
type Session=NonNullable<Awaited<ReturnType<typeof getSession>>>;
export function getSavedPoseReplay(session:Session):AnalysisReport|null;
export function prepareSavedPoseReplay(session:Session,options?:{persist?:boolean;signal?:AbortSignal;onProgress?:(progress:AnalysisProgress)=>void}):Promise<{report:AnalysisReport;cached:boolean;saveError:string|null}>;
