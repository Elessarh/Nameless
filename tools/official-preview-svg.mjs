// Native Minecraft cuboids and unchanged texture pixels, projected as SVG.
// BSP splits projected faces for correct painter order, including intersections.
const EPS=1e-7;
const LIMITS={elements:384,fragments:6000,svgBytes:750000,uvMagnitude:64};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal=v=>{const length=Math.hypot(...v);return length>EPS?v.map(x=>x/length):null;};
const valid3=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=512);
const radians=degrees=>degrees*Math.PI/180;
const fmt=value=>Math.abs(value)<.00001?'0':Number(value.toFixed(5)).toString();
const dirs={
    n:(a,b)=>[[b[0],b[1],a[2]],[a[0],b[1],a[2]],[a[0],a[1],a[2]],[b[0],a[1],a[2]]],
    s:(a,b)=>[[a[0],b[1],b[2]],[b[0],b[1],b[2]],[b[0],a[1],b[2]],[a[0],a[1],b[2]]],
    e:(a,b)=>[[b[0],b[1],b[2]],[b[0],b[1],a[2]],[b[0],a[1],a[2]],[b[0],a[1],b[2]]],
    w:(a,b)=>[[a[0],b[1],a[2]],[a[0],b[1],b[2]],[a[0],a[1],b[2]],[a[0],a[1],a[2]]],
    u:(a,b)=>[[a[0],b[1],a[2]],[b[0],b[1],a[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]],
    d:(a,b)=>[[a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],a[1],a[2]],[a[0],a[1],a[2]]]
};

export function rotatePoint(point,rotation,pivot=[0,0,0]){
    let [x,y,z]=sub(point,pivot);
    for(let axis=0;axis<3;axis++){
        const c=Math.cos(radians(rotation[axis])),s=Math.sin(radians(rotation[axis]));
        if(axis===0)[y,z]=[y*c-z*s,y*s+z*c];
        else if(axis===1)[x,z]=[x*c+z*s,-x*s+z*c];
        else [x,y]=[x*c-y*s,x*s+y*c];
    }
    return [x+pivot[0],y+pivot[1],z+pivot[2]];
}

// Blockbench display_base uses THREE.Euler's default XYZ composition. Its
// matrix is Rx * Ry * Rz: a vector therefore receives Z, then Y, then X.
// This differs from the compact native element-rotation sequence above.
// https://raw.githubusercontent.com/JannisX11/blockbench/master/js/display_mode/display_mode.js
// https://threejs.org/docs/pages/Euler.html
export function rotateGuiXYZ(point,rotation){
    let [x,y,z]=point;
    for(let axis=2;axis>=0;axis--){
        const c=Math.cos(radians(rotation[axis])),s=Math.sin(radians(rotation[axis]));
        if(axis===0)[y,z]=[y*c-z*s,y*s+z*c];
        else if(axis===1)[x,z]=[x*c+z*s,-x*s+z*c];
        else [x,y]=[x*c-y*s,x*s+y*c];
    }
    return [x,y,z];
}

export function validateModel(model){
    if(model.v!==1||!Array.isArray(model.tex)||!model.tex.length||model.tex.length>16||!Array.isArray(model.el)||!model.el.length||model.el.length>LIMITS.elements)throw new Error('unsupported-model-budget');
    if(model.tex.some(t=>typeof t!=='string'||!/^[-a-zA-Z0-9_./]+\.png$/.test(t)||t.split('/').some(p=>p==='..'||!p)))throw new Error('unsupported-texture-path');
    for(const element of model.el){
        // Reversed endpoints are authored inside-out/mirrored cuboids. Keep
        // their signed face coordinates and winding, rather than normalizing UVs.
        if(!valid3(element.a)||!valid3(element.b)||!element.f||typeof element.f!=='object')throw new Error('unsupported-cuboid');
        if(element.r&&(!Array.isArray(element.r)||element.r.length!==7||!element.r.every(Number.isFinite)||element.r.slice(3,6).some(v=>Math.abs(v)>360)||![0,1].includes(element.r[6])))throw new Error('unsupported-element-rotation');
        for(const [direction,face] of Object.entries(element.f)){
            // Authored UVs may cross an atlas edge. The official public viewer
            // samples these with CLAMP_TO_EDGE rather than repeating pixels.
            // Keep a finite production bound; do not normalize source UVs.
            if(!dirs[direction]||!Array.isArray(face)||![5,6].includes(face.length)||!face.every(Number.isFinite)||!Number.isInteger(face[4])||face[4]<0||face[4]>=model.tex.length||face.slice(0,4).some(v=>Math.abs(v)>LIMITS.uvMagnitude)||face[5]&&face[5]%90!==0)throw new Error('unsupported-face-uv');
        }
    }
    const gui=model.d?.gui;
    if(gui)for(const key of ['r','s','t'])if(gui[key]&&!valid3(gui[key]))throw new Error('unsupported-gui-transform');
    return true;
}

export function wholeFlatTexture(model){
    if(model.flat!==1||model.el.length!==1||model.tex.length!==1)return false;
    const element=model.el[0];
    if(element.r||model.d?.gui||element.a[0]!==0||element.a[1]!==0||element.b[0]!==16||element.b[1]!==16)return false;
    return ['n','s'].every(dir=>element.f[dir]?.length===5&&element.f[dir].every((value,i)=>value===[0,0,16,16,0][i]))&&Object.keys(element.f).every(dir=>['n','s'].includes(dir));
}

function elementPoint(point,element){
    if(!element.r)return point;
    const pivot=element.r.slice(0,3),rotation=element.r.slice(3,6);
    if(element.r[6]){
        const factor=1/Math.max(.1,Math.cos(radians(Math.max(...rotation.map(Math.abs)))));
        point=point.map((value,axis)=>rotation[axis]?value:pivot[axis]+(value-pivot[axis])*factor);
    }
    return rotatePoint(point,rotation,pivot);
}

function plane(face){
    for(let i=1;i+1<face.points.length;i++){
        const n=normal(cross(sub(face.points[i],face.points[0]),sub(face.points[i+1],face.points[0])));
        if(n)return {n,w:dot(n,face.points[0])};
    }
    return null;
}
function splitFace(face,partition){
    const distances=face.points.map(point=>dot(partition.n,point)-partition.w);
    const pos=distances.some(v=>v>EPS),neg=distances.some(v=>v<-EPS);
    if(!pos&&!neg)return {same:[face],front:[],back:[]};
    if(!neg)return {same:[],front:[face],back:[]};
    if(!pos)return {same:[],front:[],back:[face]};
    const front=[],back=[];
    face.points.forEach((point,i)=>{
        const j=(i+1)%face.points.length,next=face.points[j],a=distances[i],b=distances[j];
        if(a>=-EPS)front.push(point);if(a<=EPS)back.push(point);
        if((a>EPS&&b<-EPS)||(a<-EPS&&b>EPS)){
            const t=a/(a-b),cut=point.map((value,axis)=>value+(next[axis]-value)*t);
            front.push(cut);back.push(cut);
        }
    });
    const retain=points=>{const result={...face,points};return points.length>=3&&plane(result)?[result]:[];};
    return {same:[],front:retain(front),back:retain(back)};
}

export function depthOrder(faces){
    let fragments=0;
    function build(list,depth=0){
        if(!list.length)return null;
        if(depth>512)throw new Error('unsupported-bsp-depth');
        // A large source face avoids gratuitous partitions from tiny details.
        let selected=0,area=0;
        for(let i=0;i<list.length;i++){const p=list[i].points;const a=Math.hypot(...cross(sub(p[1],p[0]),sub(p[2],p[0])));if(a>area){area=a;selected=i;}}
        const partition=plane(list[selected]);if(!partition)throw new Error('degenerate-native-face');
        const same=[],front=[],back=[];
        for(const face of list){const split=splitFace(face,partition);same.push(...split.same);front.push(...split.front);back.push(...split.back);}
        fragments+=same.length;if(fragments>LIMITS.fragments)throw new Error('unsupported-bsp-budget');
        return {partition,same,front:build(front,depth+1),back:build(back,depth+1)};
    }
    const ordered=[];
    function traverse(node){if(!node)return;const front=dot(node.partition.n,[0,0,1e9])-node.partition.w>0;traverse(front?node.back:node.front);ordered.push(...node.same);traverse(front?node.front:node.back);}
    traverse(build(faces));return ordered;
}

function affine(points,uv){
    const a=points[0],b=points[1],c=points[3],u=uv[0],v=uv[1],w=uv[3];
    const du=v[0]-u[0],dv=v[1]-u[1],eu=w[0]-u[0],ev=w[1]-u[1],det=du*ev-dv*eu;
    if(Math.abs(det)<EPS)throw new Error('unsupported-degenerate-uv');
    const x=b[0]-a[0],y=b[1]-a[1],xx=c[0]-a[0],yy=c[1]-a[1];
    const aa=(x*ev-xx*dv)/det,cc=(-x*eu+xx*du)/det,bb=(y*ev-yy*dv)/det,dd=(-y*eu+yy*du)/det;
    return [aa,bb,cc,dd,a[0]-aa*u[0]-cc*u[1],a[1]-bb*u[0]-dd*u[1]];
}

// Public viewer inspected 2026-10-15 (read as source, never executed here):
// https://saominecraft.com/_next/static/chunks/6988-94f04cf0240016ae.js
// texture() explicitly selects NEAREST and CLAMP_TO_EDGE on both axes.
// A source edge texel stretched outside the image has the same nearest-neighbor
// samples as WebGL CLAMP_TO_EDGE. Each region is a clipped use of the unchanged
// PNG, including the four corners; no bitmap is repainted or resampled offline.
export function clampTextureRegions(width,height,extent){
    const axis=(size,min,max)=>[
        ...(min<0?[{from:min,to:0,sourceFrom:0,sourceTo:1}]:[]),
        {from:0,to:size,sourceFrom:0,sourceTo:size},
        ...(max>size?[{from:size,to:max,sourceFrom:size-1,sourceTo:size}]:[])
    ];
    return axis(width,extent.minU,extent.maxU).flatMap(x=>axis(height,extent.minV,extent.maxV).map(y=>{
        const sx=(x.to-x.from)/(x.sourceTo-x.sourceFrom),sy=(y.to-y.from)/(y.sourceTo-y.sourceFrom);
        return {rect:[x.from,y.from,x.to-x.from,y.to-y.from],matrix:[sx,0,0,sy,x.from-sx*x.sourceFrom,y.from-sy*y.sourceFrom]};
    }));
}

function textureSamplers(model,textures,defs){
    const extents=textures.map(texture=>({minU:0,maxU:texture.width,minV:0,maxV:texture.height}));
    for(const element of model.el)for(const face of Object.values(element.f)){
        const texture=textures[face[4]],extent=extents[face[4]];
        const u=[face[0],face[2]].map(value=>value/16*texture.width),v=[face[1],face[3]].map(value=>value/16*texture.height);
        extent.minU=Math.min(extent.minU,...u);extent.maxU=Math.max(extent.maxU,...u);
        extent.minV=Math.min(extent.minV,...v);extent.maxV=Math.max(extent.maxV,...v);
    }
    return textures.map((texture,index)=>{
        const extent=extents[index];
        if(extent.minU===0&&extent.maxU===texture.width&&extent.minV===0&&extent.maxV===texture.height)return 'tx'+index;
        const regions=clampTextureRegions(texture.width,texture.height,extent),body=[];
        regions.forEach((region,position)=>{
            const id='edge'+index+'-'+position,[x,y,width,height]=region.rect;
            defs.push('<clipPath id="'+id+'"><rect x="'+fmt(x)+'" y="'+fmt(y)+'" width="'+fmt(width)+'" height="'+fmt(height)+'"/></clipPath>');
            body.push('<g clip-path="url(#'+id+')"><use href="#tx'+index+'" transform="matrix('+region.matrix.map(fmt).join(' ')+')"/></g>');
        });
        const id='sampledTx'+index;defs.push('<g id="'+id+'">'+body.join('')+'</g>');return id;
    });
}

// A constant native UV axis samples one texel column/row with NEAREST. Express
// that same sample as its one-pixel image interval so the SVG affine remains
// invertible; this changes neither authored UVs nor embedded native pixels.
// floor(s * size), clamped to [0,size-1], also preserves the exact edge sample.
export function sampledFaceUvRect(face,texture){
    let u1=face[0]/16*texture.width,v1=face[1]/16*texture.height,u2=face[2]/16*texture.width,v2=face[3]/16*texture.height;
    const texel=(coordinate,size)=>Math.max(0,Math.min(size-1,Math.floor(coordinate)));
    if(u1===u2){u1=texel(u1,texture.width);u2=u1+1;}
    if(v1===v2){v1=texel(v1,texture.height);v2=v1+1;}
    return [[u1,v1],[u2,v1],[u2,v2],[u1,v2]];
}

export function renderNativeSvg(model,textures){
    validateModel(model);
    if(textures.length!==model.tex.length||textures.some(t=>!Buffer.isBuffer(t.bytes)||!Number.isInteger(t.width)||!Number.isInteger(t.height)))throw new Error('missing-native-texture');
    const defs=textures.map((texture,i)=>'<image id="tx'+i+'" width="'+texture.width+'" height="'+texture.height+'" href="data:image/png;base64,'+texture.bytes.toString('base64')+'"/>');
    if(wholeFlatTexture(model)){
        const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" style="image-rendering:pixelated"><defs>'+defs.join('')+'</defs><use href="#tx0" transform="scale('+(232/textures[0].width)+' '+(232/textures[0].height)+') translate('+fmt(12*textures[0].width/232)+' '+fmt(12*textures[0].height/232)+')"/></svg>';
        return {svg,status:'safe-flat',nativeFlatVerified:true,geometry:{elements:1,sourceFaces:2,projectedFragments:1,gui:'verified-flat-whole-texture'}};
    }
    const gui=model.d?.gui,rotation=gui?.r||[18,-35,0],scale=gui?.s||[1,1,1],translation=gui?.t||[0,0,0];
    // A zero authored axis intentionally flattens a model; retain it as long as
    // the remaining axes still produce visible native faces. Mirrored GUI
    // transforms require separate winding support and remain unsupported.
    if(scale.some(v=>v<0))throw new Error('unsupported-gui-scale');
    const samplers=textureSamplers(model,textures,defs);
    const faces=[];let sourceFaces=0;
    for(const element of model.el)for(const [direction,face] of Object.entries(element.f)){
        sourceFaces++;
        const native=dirs[direction](element.a,element.b).map(point=>elementPoint(point,element));
        const sourceNormal=normal(cross(sub(native[1],native[0]),sub(native[2],native[0])))?.map(v=>-v);
        if(!sourceNormal)continue;
        const points=native.map(point=>(gui?.r?rotateGuiXYZ:rotatePoint)(point.map((v,i)=>(v-8)*scale[i]),rotation).map((v,i)=>v+translation[i]));
        const outward=normal(cross(sub(points[1],points[0]),sub(points[2],points[0])))?.map(v=>-v);
        if(!outward||outward[2]<=EPS)continue;
        const texture=face[4],turn=((face[5]||0)/90%4+4)%4;
        const rect=sampledFaceUvRect(face,textures[texture]);
        const uv=[0,1,2,3].map(i=>rect[(i-turn+4)%4]);
        const [x,y,z]=sourceNormal;
        const shade=element.sh===0?1:.35+.65*Math.min(1,x*x*.6+z*z*.8+y*y*(y>0?1:.5));
        faces.push({points,anchors:points,uv,texture,shade});
    }
    if(!faces.length)throw new Error('unsupported-empty-projection');
    const all=faces.flatMap(face=>face.points),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max(maxX-minX,maxY-minY);
    if(span<EPS)throw new Error('unsupported-empty-projection');
    const pixelScale=232/span,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const project=point=>[(point[0]-cx)*pixelScale+128,128-(point[1]-cy)*pixelScale];
    const ordered=depthOrder(faces),body=[];
    const shades=new Map();
    for(const face of ordered){const value=fmt(face.shade);if(!shades.has(value)){const id='light'+shades.size;shades.set(value,id);defs.push('<filter id="'+id+'" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="'+value+' 0 0 0 0 0 '+value+' 0 0 0 0 0 '+value+' 0 0 0 0 0 1 0"/></filter>');}}
    ordered.forEach((face,index)=>{
        const id='face'+index,points=face.points.map(project).map(point=>point.map(fmt).join(',')).join(' ');
        defs.push('<clipPath id="'+id+'"><polygon points="'+points+'"/></clipPath>');
        const matrix=affine(face.anchors.map(project),face.uv).map(fmt).join(' ');
        body.push('<g clip-path="url(#'+id+')"><use href="#'+samplers[face.texture]+'" transform="matrix('+matrix+')" filter="url(#'+shades.get(fmt(face.shade))+')"/></g>');
    });
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" style="image-rendering:pixelated"><defs>'+defs.join('')+'</defs>'+body.join('')+'</svg>';
    if(Buffer.byteLength(svg)>LIMITS.svgBytes)throw new Error('unsupported-svg-byte-budget');
    return {svg,status:'native-model-render',nativeFlatVerified:false,geometry:{elements:model.el.length,sourceFaces,visibleFaces:faces.length,projectedFragments:ordered.length,gui:gui?'official-gui-transform':'orthographic-default-view',rotation,scale,translation}};
}
