# Automated generation of a self-contained animated 3D Design01 horse for Race Lab.
# All dimensions and materials are in meters; horse faces +X, up is +Y.
import json, math, struct
from pathlib import Path
import numpy as np, trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals
from PIL import Image,ImageDraw,ImageFont
from scipy.interpolate import CubicSpline

OUT=Path('assets/Design01_animated.glb')
OUT.parent.mkdir(exist_ok=True)
sc=trimesh.Scene()
colors={
 'coat':'#533832','lightcoat':'#6b4a3d','nose':'#856153',
 'hair':'#30201c','hair2':'#50352d','white':'#f8f9f5',
 'iris':'#84522c','pupil':'#110f10','eyewhite':'#fffaf0','eyelid':'#211a17',
 'blue':'#185edc','deepblue':'#0e2c76','skin':'#e4b692',
 'boots':'#1d1c22','silver':'#d3dad9','nostril':'#2c1e1d',
 'glint':'#ffffff','inner':'#b5756b'}
materials={}
for name,hx in colors.items():
    col=[int(hx[i:i+2],16) for i in (1,3,5)]
    rough=.24 if name in ['silver','glint','iris','pupil'] else .32 if name in ['blue','coat','lightcoat','hair'] else .48
    metal=.6 if name=='silver' else .015
    materials[name]=PBRMaterial(name=name,baseColorFactor=[*col,255],roughnessFactor=rough,metallicFactor=metal,doubleSided=True)
n=0
meshBuckets={}
def part(mesh,color,group='HorseRoot',name='detail'):
    global n
    mesh.remove_unreferenced_vertices()
    mesh.visual=TextureVisuals(uv=np.zeros((len(mesh.vertices),2)),material=materials[color])
    # Merge non-moving parts within the same animation joint and material.
    meshBuckets.setdefault((group,color),[]).append(mesh)
def group(name,parent='HorseRoot',at=(0,0,0)):
    m=np.eye(4);m[:3,3]=at
    sc.graph.update(frame_from=parent,frame_to=name,matrix=m)
group('HorseRoot','world')
def ell(at,size,color,groupname='HorseRoot',name='ellipsoid',subdiv=3):
    m=trimesh.creation.icosphere(subdivisions=subdiv)
    m.vertices*=np.asarray(size);m.apply_translation(at);part(m,color,groupname,name)
def loft(profiles,color,groupname='HorseRoot',name='sculpt'):
    samples=[]
    for a,b in zip(profiles[:-1],profiles[1:]):
        a=np.asarray(a,float);b=np.asarray(b,float)
        for i in range(5):
            t=i/5;t=t*t*(3-2*t);samples.append(a+(b-a)*t)
    samples.append(np.asarray(profiles[-1],float))
    verts=[];faces=[];rings=26
    for x,y,r1,r2 in samples:
        for j in range(rings):
            t=2*np.pi*j/rings;verts.append([x,y+np.cos(t)*r1,np.sin(t)*r2])
    for i in range(len(samples)-1):
        for j in range(rings):
            a=i*rings+j;b=(i+1)*rings+j;c=i*rings+(j+1)%rings;d=(i+1)*rings+(j+1)%rings
            faces.extend([[a,b,c],[b,d,c]])
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    if mesh.volume<0:mesh.invert()
    part(mesh,color,groupname,name)
def strand(points,radii,color,groupname='HorseRoot',name='curve'):
    ps=np.asarray(points,float);rs=np.asarray(radii,float)
    if len(ps)>=3:
        ticks=np.arange(len(ps));fine=np.linspace(0,len(ps)-1,(len(ps)-1)*5+1)
        ps=CubicSpline(ticks,ps,axis=0)(fine)
        rs=np.clip(CubicSpline(ticks,rs)(fine),.005,None)
    verts=[];faces=[];segments=9
    for i,p in enumerate(ps):
        tangent=ps[min(i+1,len(ps)-1)]-ps[max(i-1,0)]
        tangent=tangent/(np.linalg.norm(tangent)+1e-8)
        ref=np.array([0.,0.,1.]) if abs(tangent[2])<.85 else np.array([0.,1.,0.])
        u=np.cross(tangent,ref);u/=np.linalg.norm(u)+1e-9;v=np.cross(tangent,u)
        for j in range(segments):
            theta=2*np.pi*j/segments
            verts.append(p+rs[i]*(u*np.cos(theta)+v*np.sin(theta)))
        if i:
            for j in range(segments):
                a=(i-1)*segments+j;b=(i-1)*segments+(j+1)%segments;c=i*segments+j;d=i*segments+(j+1)%segments
                faces.extend([[a,c,b],[b,c,d]])
    part(trimesh.Trimesh(vertices=verts,faces=faces,process=False),color,groupname,name)

# Curved body: broad shoulders, compact athletic waist and rounded haunches.
loft([[-1.7,1.50,.07,.06],[-1.43,1.53,.5,.48],[-1.06,1.53,.67,.63],
      [-.51,1.54,.72,.68],[.14,1.56,.70,.69],[.68,1.60,.65,.61],
      [1.05,1.66,.48,.46],[1.23,1.71,.05,.05]],'coat',name='smooth-body')
ell([-1.13,1.52,0],[.50,.57,.52],'lightcoat',name='round-hips')
ell([.78,1.57,0],[.49,.58,.54],'coat',name='rounded-shoulder')
group('NeckPivot','HorseRoot',(.75,1.60,0))
loft([[-.39,.07,.28,.30],[-.08,.20,.51,.46],[.22,.4,.56,.53],
      [.49,.64,.49,.47],[.78,.82,.37,.35],[1.05,.86,.06,.06]],
      'coat','NeckPivot','rounded-neck')
group('HeadPivot','NeckPivot',(.88,.72,0))
loft([[-.54,.11,.07,.06],[-.40,.10,.48,.47],[-.16,.10,.68,.64],
      [.10,.09,.76,.68],[.38,.01,.66,.63],[.63,-.09,.50,.53],
      [.86,-.23,.42,.49],[1.12,-.3,.38,.44],[1.30,-.31,.06,.06]],
      'coat','HeadPivot','large-short-rounded-head')
ell([1.06,-.31,0],[.36,.34,.44],'nose','HeadPivot','rounded-short-muzzle')
strand([[-.31,.70,0],[-.07,.87,0],[.17,.89,0],[.42,.66,0],[.68,.34,0],[.99,.14,0]],
       [.08,.12,.12,.093,.065,.053],'white','HeadPivot','face-blaze')
for s in (-1,1):
    ell([.27,-.14,s*.4],[.39,.35,.29],'lightcoat','HeadPivot','plush-cheeks')
    ell([.16,.28,s*.627],[.27,.31,.15],'eyelid','HeadPivot','eyelid-rim')
    ell([.19,.27,s*.708],[.237,.27,.11],'eyewhite','HeadPivot','eye-white')
    ell([.28,.25,s*.784],[.169,.197,.061],'iris','HeadPivot','large-brown-iris')
    ell([.31,.24,s*.828],[.107,.13,.037],'pupil','HeadPivot','pupil')
    ell([.34,.35,s*.857],[.056,.060,.02],'glint','HeadPivot','light-reflection',2)
    ell([1.25,-.24,s*.34],[.071,.092,.045],'nostril','HeadPivot','nostril')
    strand([[-.27,.76,s*.41],[-.27,1.0,s*.44],[-.36,1.20,s*.46]],
           [.13,.13,.006],'coat','HeadPivot','horse-ear')
    strand([[-.27,.86,s*.468],[-.28,1.03,s*.472],[-.33,1.15,s*.46]],
           [.056,.064,.005],'inner','HeadPivot','ear-inner')
    strand([[-.37,.61,s*.39],[0,.68,s*.61],[.27,.55,s*.64]],
           [.043,.044,.040],'blue','HeadPivot','blue-browband')
    strand([[-.09,.5,s*.64],[.28,.12,s*.66],[.83,-.29,s*.49]],
           [.045,.043,.047],'blue','HeadPivot','bridle-strap')
    strand([[.91,-.31,s*.45],[1.13,-.33,s*.43],[1.29,-.26,s*.28]],
           [.064,.066,.062],'blue','HeadPivot','noseband')
    ell([.94,-.33,s*.49],[.084,.079,.043],'silver','HeadPivot','bit')
for i in range(10):
    z=(i%4-1.5)*.08;x=-.43+(i%5)*.10
    strand([[x,.86,z],[x+.13,1.06,z*1.2],[x+.35,.99-(i%3)*.05,z*1.3]],
           [.13,.135,.006],'hair' if i%3 else 'hair2','HeadPivot','forelock')
for i in range(11):
    z=(i%3-1)*.10;t=i/10
    strand([[-.28+t*.85,1.01-t*.08,z],[-.44+t*.78,1.12-t*.04,z],[-.68+t*.8,1.05,z]],
           [.14,.13,.006],'hair' if i%3 else 'hair2','NeckPivot','mane')
group('TailPivot','HorseRoot',(-1.64,1.76,0))
ell([-.17,.04,0],[.33,.23,.23],'hair','TailPivot','tail-root')
for i in range(12):
    z=(i-5.5)*.052
    strand([[-.22,.05,z*.6],[-.56,.02,z],[-1.04,-.13,z*1.35],[-1.34,-.23,z*1.24]],
           [.10,.11,.066,.006],'hair' if i%3 else 'hair2','TailPivot','long-tail')
legs=[]
for name,x in [('Hind',-1.05),('Front',.72)]:
  for side,z in [('Far',-.45),('Near',.45)]:
    hip=f'{name}{side}Hip';knee=f'{name}{side}Knee';legs.append((hip,knee,name,side))
    group(hip,'HorseRoot',(x,1.26,z))
    strand([[0,.09,0],[.01,-.14,0],[.04,-.39,0],[.04,-.55,0]],
           [.282,.255,.213,.15],'coat',hip,'upper-leg')
    group(knee,hip,(.04,-.55,0))
    strand([[0,.07,0],[0,-.18,0],[.06,-.41,0]],
           [.19,.188,.16],'coat',knee,'lower-leg')
    if (name=='Front' and side=='Near') or (name=='Hind' and side=='Far'):
        ell([.065,-.43,0],[.194,.151,.19],'white',knee,'white-sock')
    ell([.12,-.55,0],[.263,.13,.248],'boots',knee,'hoof')
    ell([.29,-.55,0],[.030,.085,.151],'silver',knee,'hoof-tip')
ell([-.23,2.18,0],[.64,.15,.55],'white',name='saddle-padding')
ell([-.32,2.23,0],[.47,.17,.46],'boots',name='saddle-leather')
# Real textured saddlecloth: white number 4 on blue, with white border.
im=Image.new('RGBA',(384,320),'#1556d9')
draw=ImageDraw.Draw(im);draw.rounded_rectangle((12,12,372,308),radius=28,outline='white',width=22)
try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',225)
except:font=ImageFont.load_default()
draw.text((192,156),'4',fill='white',font=font,anchor='mm')
nummat=PBRMaterial(name='Saddlecloth4',baseColorFactor=[255,255,255,255],baseColorTexture=im,roughnessFactor=.37,doubleSided=True)
for s in (-1,1):
    xs=[-.96,-.74,-.5,-.27,-.03,.12];ys=[1.41,1.62,1.83,2.04,2.16]
    verts=[];uv=[];faces=[]
    for y in ys:
      for x in xs:
        verts.append([x,y,s*.76]);uv.append([(x-xs[0])/(xs[-1]-xs[0]),(y-ys[0])/(ys[-1]-ys[0])])
    for i in range(len(ys)-1):
      for j in range(len(xs)-1):
        a=i*len(xs)+j;b=a+1;c=a+len(xs);d=c+1
        faces.extend([[a,b,c],[b,d,c],[c,b,a],[c,d,b]])
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    mesh.visual=TextureVisuals(uv=np.array(uv),material=nummat)
    n+=1;sc.add_geometry(mesh,geom_name='saddlecloth-geo'+str(n),node_name='Saddlecloth4_'+str(n),parent_node_name='HorseRoot')
    strand([[-.12,2.17,s*.52],[-.19,1.61,s*.7],[-.23,1.12,s*.5]],
           [.045,.048,.041],'boots',name='saddle-strap')
    strand([[2.54,2.21,s*.34],[1.89,2.44,s*.53],[1.09,2.6,s*.48],[.47,2.64,s*.22]],
           [.028,.028,.023,.014],'deepblue',name='reins')
group('RiderPivot','HorseRoot',(-.35,2.18,0))
ell([-.08,-.035,0],[.33,.23,.36],'white','RiderPivot','rider-breeches')
for s in (-1,1):
    strand([[-.05,-.10,s*.28],[.19,-.37,s*.55],[.24,-.43,s*.57]],
           [.15,.15,.12],'white','RiderPivot','white-thighs')
    strand([[.24,-.41,s*.56],[.16,-.56,s*.63],[-.24,-.68,s*.70]],
           [.11,.11,.09],'boots','RiderPivot','riding-boots')
    ell([-.25,-.68,s*.71],[.22,.10,.14],'boots','RiderPivot','boot-toe')
ell([.22,.35,0],[.42,.44,.35],'blue','RiderPivot','racing-jacket')
for s in (-1,1):
    ell([.30,.46,s*.28],[.24,.185,.18],'blue','RiderPivot','jockey-sleeve')
    for x,y in [(.12,.39),(.25,.48),(.36,.33),(.40,.54),(.09,.57)]:
        # Thin white oval patches form the diamond silhouette without extra geometry.
        ell([x,y,s*.342],[.08,.091,.019],'white','RiderPivot','racing-diamond',subdiv=2)
ell([.54,.87,0],[.28,.27,.26],'skin','RiderPivot','small-face')
ell([.53,1.15,0],[.45,.29,.42],'deepblue','RiderPivot','helmet-rim')
ell([.54,1.20,0],[.43,.26,.41],'blue','RiderPivot','helmet')
ell([.81,1.07,0],[.30,.076,.30],'blue','RiderPivot','visor')
strand([[.15,1.19,0],[.31,1.40,0],[.54,1.47,0],[.79,1.38,0],[.94,1.19,0]],
       [.063,.075,.077,.068,.045],'white','RiderPivot','helmet-stripe')
for s in (-1,1):
    ell([.78,.92,s*.15],[.163,.089,.116],'boots','RiderPivot','goggles')
    ell([.81,.925,s*.15],[.14,.075,.104],'deepblue','RiderPivot','dark-lens')
    ell([.9,.95,s*.166],[.028,.02,.015],'glint','RiderPivot','lens-glint',subdiv=2)
    strand([[.30,.56,s*.24],[.53,.38,s*.33],[.84,.28,s*.27]],
           [.15,.137,.106],'blue','RiderPivot','arms')
    ell([.84,.28,s*.27],[.112,.105,.104],'deepblue','RiderPivot','glove')
# Reduce GPU draw calls by fusing geometry of the same material/joint.
# Separate animation joints remain intact (hips, knees, neck, head, tail, rider).
for (parent,color),items in meshBuckets.items():
    combined=trimesh.util.concatenate(items)
    combined.remove_unreferenced_vertices()
    combined.visual=TextureVisuals(uv=np.zeros((len(combined.vertices),2)),material=materials[color])
    n+=1
    sc.add_geometry(combined,geom_name='merged-'+str(n),node_name='merged_'+parent+'_'+color+'_'+str(n),parent_node_name=parent)
print('Optimized number of pieces',n)
# Encode a 1.6s looping full-body gallop as glTF animation.
b=trimesh.exchange.gltf.export_glb(sc);idx=12;chunks={}
while idx<len(b):
    size,typ=struct.unpack_from('<I4s',b,idx);idx+=8
    chunks[typ]=b[idx:idx+size];idx+=size
root=json.loads(chunks[b'JSON'].decode().strip('\0 '));raw=bytearray(chunks[b'BIN\0'])
lookup={v.get('name'):i for i,v in enumerate(root['nodes'])}
animated=['HorseRoot','NeckPivot','HeadPivot','TailPivot','RiderPivot']+[x for hip,knee,_,_ in legs for x in [hip,knee]]
for name in animated:
    node=root['nodes'][lookup[name]]
    mt=np.array(node.pop('matrix',np.eye(4).reshape(-1,order='F').tolist())).reshape(4,4,order='F')
    node.update(translation=mt[:3,3].tolist(),rotation=[0.,0.,0.,1.],scale=[1.,1.,1.])
def accessor(arr,kind):
    arr=np.asarray(arr,dtype='<f4')
    while len(raw)%4:raw.append(0)
    offset=len(raw);bdata=arr.tobytes();raw.extend(bdata)
    vi=len(root['bufferViews']);root['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(bdata)})
    ai=len(root['accessors']);root['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(arr),'type':kind})
    return ai
times=np.linspace(0,1.6,49,dtype=np.float32);phase=times/times[-1]*4*np.pi
tidx=accessor(times,'SCALAR');clip={'name':'Design01_Gallop_Loop','channels':[],'samplers':[]}
def track(name,path,values):
    oi=accessor(values,'VEC4' if path=='rotation' else 'VEC3')
    si=len(clip['samplers']);clip['samplers'].append({'input':tidx,'output':oi,'interpolation':'LINEAR'})
    clip['channels'].append({'sampler':si,'target':{'node':lookup[name],'path':path}})
def qz(a):return np.stack([np.zeros_like(a),np.zeros_like(a),np.sin(a/2),np.cos(a/2)],axis=1)
for hip,knee,name,side in legs:
    offset=(0 if side=='Near' else .46)+(0 if name=='Front' else math.pi)
    track(hip,'rotation',qz(.48*np.sin(phase+offset)))
    track(knee,'rotation',qz(-.15-.49*np.maximum(0,np.sin(phase+offset+.75))))
for partname,magnitude,offset in [('NeckPivot',.035,.8),('HeadPivot',.055,1.5),('TailPivot',.10,.45),('RiderPivot',.03,.65)]:
    track(partname,'rotation',qz(magnitude*np.sin(phase+offset)))
track('HorseRoot','translation',np.stack([times*0,.03+.07*np.abs(np.sin(phase)),times*0],axis=1))
root.setdefault('animations',[]).append(clip)
root['buffers'][0]['byteLength']=len(raw)
j=json.dumps(root,separators=(',',':')).encode('utf8');j+=b' '*((-len(j))%4);raw+=b'\0'*(-len(raw)%4)
with OUT.open('wb') as f:
    f.write(struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(raw)))
    f.write(struct.pack('<I4s',len(j),b'JSON'));f.write(j)
    f.write(struct.pack('<I4s',len(raw),b'BIN\0'));f.write(raw)
print('Wrote',OUT,OUT.stat().st_size,'bytes; meshes',len(root['meshes']),'gallop channels',len(clip['channels']))
