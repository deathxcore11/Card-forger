export const BROWSE_TYPES=new Set(['card','tcard','proven','idea','market','buy','tbuild','build','variant-art','zoom','binder']);
export function sheetKey(ctx){return ctx ? [ctx.type,ctx.game||'',ctx.id||ctx.name||ctx.key||ctx.binder||'',ctx.print?.id||''].join('|') : '';}
export class SheetHistory{
 constructor(limit=12){this.limit=limit;this.items=[];}
 push(snapshot,next){if(!snapshot?.ctx||!BROWSE_TYPES.has(snapshot.ctx.type)||snapshot.ctx===next||sheetKey(snapshot.ctx)===sheetKey(next))return false;this.items.push(snapshot);if(this.items.length>this.limit)this.items.shift();return true;}
 pop(){return this.items.pop();}clear(){this.items=[];}get length(){return this.items.length;}
}
