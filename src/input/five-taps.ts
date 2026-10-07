/** Five short, single-finger taps. Holds, drags, extra fingers and long gaps reset it. */
export class FiveTaps {
  private count=0;
  private last=-Infinity;
  private press?:{id:number;x:number;y:number;at:number};
  down(id:number,x:number,y:number,at:number,primary=true){
    if(!primary||this.press){this.cancel();return;}
    if(at-this.last>750)this.count=0;
    this.press={id,x,y,at};
  }
  move(id:number,x:number,y:number){
    if(this.press?.id===id&&Math.hypot(x-this.press.x,y-this.press.y)>12)this.cancel();
  }
  up(id:number,x:number,y:number,at:number):boolean{
    const p=this.press;if(!p||p.id!==id)return false;
    this.press=undefined;
    if(at-p.at>250||Math.hypot(x-p.x,y-p.y)>12){this.cancel();return false;}
    this.last=at;
    if(++this.count===5){this.cancel();return true;}
    return false;
  }
  cancel(){this.press=undefined;this.count=0;this.last=-Infinity;}
}
