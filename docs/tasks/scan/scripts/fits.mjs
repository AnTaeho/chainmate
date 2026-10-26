import { chooseFit } from '/Users/antaeho/workspace/projects/chainmate/src/ui/fit.js';
const W = [
 ['iPad 1180x820 @2 (coarse, safari bars?)',1180,820,2,true],
 ['iPad port 820x1180 @2',820,1180,2,true],
 ['Android 915x412 @2.625',915,412,2.625,true],
 ['Android port 412x915 @2.625',412,915,2.625,true],
 ['1366x768 @1',1366,768,1,false],
 ['2560x1440 @1',2560,1440,1,false],
 ['1470x956 @2',1470,956,2,false],
 ['400x300 @1',400,300,1,false],
 ['400x300 @2',400,300,2,false],
 ['iPhone land 734x343 @3',734,343,3,true],
 ['iPhone port 393x659 @3',393,659,3,true],
 ['1280x720 @1.5',1280,720,1.5,false],
 ['1920x1080 @1.25 (win laptop 1536x864)',1536,864,1.25,false],
 ['3840x2160 @1',3840,2160,1,false],
 ['3840x2160 @1.5 -> 2560x1440',2560,1440,1.5,false],
];
for (const [n,vw,vh,dpr,coarse] of W) for (const fill of [true,false]) {
  const f = chooseFit({ vw, vh, dpr, coarse, fill, gutter: coarse && fill ? {top:12,bottom:12}:null, full:{width:vw,height:vh} });
  const c = f.canvas;
  const back = f.fill ? `${Math.round(480*f.n)}x${Math.round(270*f.n)}` : `${480*f.n}x${270*f.n}`;
  console.log(`${n.padEnd(42)} ${fill?'fill':'int '} K=${(+f.k).toFixed(3)} n=${(+f.n).toFixed(3)} css=${f.css.toFixed(3)} rot=${f.rot} canvas ${c.width.toFixed(1)}x${c.height.toFixed(1)} @${c.left.toFixed(2)},${c.top.toFixed(2)} back ${back} cover ${(100*c.width*c.height/(vw*vh)).toFixed(0)}% pad ${f.pad.width?.toFixed?.(0)}x${f.pad.height?.toFixed?.(0)} dev ${f.pad.dev?JSON.stringify(f.pad.dev):''}`);
}
