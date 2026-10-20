"""Reproduce the reviewed, source-native extended illustration windows for cel25-23."""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, box

root = Path(__file__).resolve().parent.parent
fixtures = root / 'tests/fixtures/anniversary-frames'
# Hand seed follows only Oak's protruding sleeve, hand and pen. The final edge
# comes from the retained image pixels; paper and writing outside it stay clear.
arm = np.array([[210,420],[211,426],[214,435],[224,439],[231,443],[238,452],[258,457],[274,463],[280,468],[284,476],[296,473],[308,468],[320,469],[332,473],[341,481],[351,485],[357,492],[356,500],[371,503],[382,510],[384,515],[380,520],[368,520],[359,516],[354,524],[347,534],[337,541],[324,545],[314,547],[306,552],[296,551],[286,544],[273,534],[269,529],[262,541],[259,544],[244,539],[228,532],[212,525],[198,519],[184,511],[170,501],[159,490],[149,477],[141,461],[134,445],[128,435],[125,426],[124,420]],float)
records = []
for name, frame in [('cel25-23-high.webp',(50,119,552,426)),('cel25-23-source.png',(59,146,674,529))]:
    image = np.array(Image.open(fixtures/name).convert('RGB'))
    height,width = image.shape[:2]
    seed = arm.copy()
    left,top,right,bottom = frame
    if name.endswith('.png'):
        seed[:,0] = left+(seed[:,0]-50)*(right-left)/502
        seed[:,1] = top+(seed[:,1]-119)*(bottom-top)/307
    polygon = Polygon(seed)
    labels = np.zeros((height,width),np.uint8)
    for shape,value in [(polygon.buffer(10),cv2.GC_PR_BGD),(polygon,cv2.GC_PR_FGD),(polygon.buffer(-5),cv2.GC_FGD)]:
        cv2.fillPoly(labels,[np.array(shape.exterior.coords,np.int32)],value)
    cv2.setRNGSeed(0)
    cv2.grabCut(image,labels,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK)
    mask = np.isin(labels,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype(np.uint8)
    contours,_ = cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    points = cv2.approxPolyDP(max(contours,key=cv2.contourArea),.45,True).reshape(-1,2).tolist()
    field = box(*frame).union(Polygon(points).buffer(-.35,join_style='mitre')).simplify(.35,preserve_topology=True)
    parts = list(field.geoms) if field.geom_type=='MultiPolygon' else [field]
    parts.sort(key=lambda part:part.area,reverse=True)
    # Insetting a one-pixel pen edge can leave subpixel numerical islands.
    assert all(part.area<1 for part in parts[1:])
    field = parts[0]
    assert field.bounds[3]>height*.65, 'Extended arm must remain connected to the artwork'
    records.append({'file':name,'frame':frame,'armSeed':seed.tolist(),'armContour':points,'discardedSubpixelArea':sum(part.area for part in parts[1:]),'window':list(field.exterior.coords),'width':width,'height':height})
(fixtures/'cel25-23-windows.json').write_text(json.dumps({'method':'Native inner-frame contrast edges and hand-seeded GrabCut arm silhouette (RNG 0, five iterations), inset .35 pixel. Reviewed against retained sources. Approximate reference-art preview, not physical foil evidence.','sources':records},indent=2)+'\n')
print('Measured two source-specific Professor’s Research illustration windows.')
