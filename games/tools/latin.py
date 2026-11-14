# English -> Latin (Terminologia Anatomica) for pin answers. Muscles get "musculus ...".
import json, sys
M = 'musculus '
L = {
 'accessory nerve':'nervus accessorius','aortic arch':'arcus aortae','auricularis anterior':M+'auricularis anterior','auricularis posterior':M+'auricularis posterior',
 'auricularis superior':M+'auricularis superior','auriculotemporal nerve':'nervus auriculotemporalis','axillary artery':'arteria axillaris','brachial plexus':'plexus brachialis',
 'brachiocephalic vein':'vena brachiocephalica','buccinator':M+'buccinator','central tendon':'centrum tendineum','cervical plexus':'plexus cervicalis','coeliac plexus':'plexus coeliacus',
 'coeliac trunk':'truncus coeliacus','common carotid artery':'arteria carotis communis','common facial vein':'vena facialis','common hepatic artery':'arteria hepatica communis',
 'coracobrachialis':M+'coracobrachialis','corrugator supercilii':M+'corrugator supercilii','deltoid':M+'deltoideus','depressor anguli oris':M+'depressor anguli oris',
 'depressor labii inferioris':M+'depressor labii inferioris','diaphragm':'diaphragma','digastric anterior belly':'venter anterior musculi digastrici',
 'digastric posterior belly':'venter posterior musculi digastrici','epicranial aponeurosis':'galea aponeurotica','erector spinae':M+'erector spinae',
 'external carotid artery':'arteria carotis externa','external intercostal':'musculi intercostales externi','external jugular vein':'vena jugularis externa',
 'external oblique':M+'obliquus externus abdominis','facial artery':'arteria facialis','facial vein':'vena facialis','frontalis':'venter frontalis musculi occipitofrontalis',
 'gastroduodenal artery':'arteria gastroduodenalis','great auricular nerve':'nervus auricularis magnus','greater occipital nerve':'nervus occipitalis major',
 'greater splanchnic nerve':'nervus splanchnicus major','hyoglossus':M+'hyoglossus','iliacus':M+'iliacus','iliocostalis':M+'iliocostalis','iliocostalis cervicis':M+'iliocostalis cervicis',
 'iliohypogastric nerve':'nervus iliohypogastricus','inferior alveolar nerve':'nervus alveolaris inferior','inferior mesenteric artery':'arteria mesenterica inferior',
 'inferior mesenteric vein':'vena mesenterica inferior','inferior thyroid vein':'vena thyroidea inferior','infraorbital nerve':'nervus infraorbitalis','infraspinatus':M+'infraspinatus',
 'intercostal nerve':'nervus intercostalis','internal intercostal':'musculi intercostales interni','internal jugular vein':'vena jugularis interna','internal oblique':M+'obliquus internus abdominis',
 'jejunal arteries':'arteriae jejunales','lateral pterygoid':M+'pterygoideus lateralis','latissimus dorsi':M+'latissimus dorsi','left colic artery':'arteria colica sinistra',
 'left gastric artery':'arteria gastrica sinistra','lesser occipital nerve':'nervus occipitalis minor','levator anguli oris':M+'levator anguli oris','levator labii superioris':M+'levator labii superioris',
 'levator labii superioris alaeque nasi':M+'levator labii superioris alaeque nasi','levator scapulae':M+'levator scapulae','linea alba':'linea alba','lingual nerve':'nervus lingualis',
 'longissimus':M+'longissimus','longissimus capitis':M+'longissimus capitis','masseter':M+'masseter','mental nerve':'nervus mentalis','mentalis':M+'mentalis',
 'middle colic artery':'arteria colica media','mylohyoid':M+'mylohyoideus','nasalis':M+'nasalis','occipital artery':'arteria occipitalis','occipitalis':'venter occipitalis musculi occipitofrontalis',
 'oesophagus':'oesophagus','omohyoid inferior belly':'venter inferior musculi omohyoidei','omohyoid superior belly':'venter superior musculi omohyoidei','orbicularis oculi':M+'orbicularis oculi',
 'orbicularis oris':M+'orbicularis oris','pectoralis major':M+'pectoralis major','pectoralis minor':M+'pectoralis minor','platysma':'platysma','portal vein':'vena portae hepatis','procerus':M+'procerus',
 'psoas major':M+'psoas major','psoas minor':M+'psoas minor','pyramidalis':M+'pyramidalis','quadratus lumborum':M+'quadratus lumborum','rectus abdominis':M+'rectus abdominis',
 'rectus sheath':'vagina musculi recti abdominis','recurrent laryngeal nerve':'nervus laryngeus recurrens','retromandibular vein':'vena retromandibularis','rhomboid major':M+'rhomboideus major',
 'rhomboids':'musculi rhomboidei','right colic artery':'arteria colica dextra','right crus of diaphragm':'crus dextrum diaphragmatis','risorius':M+'risorius','scalenus anterior':M+'scalenus anterior',
 'scalenus medius':M+'scalenus medius','semispinalis capitis':M+'semispinalis capitis','serratus anterior':M+'serratus anterior','serratus posterior inferior':M+'serratus posterior inferior',
 'serratus posterior superior':M+'serratus posterior superior','sigmoid arteries':'arteriae sigmoideae','spinalis':M+'spinalis','splenic artery':'arteria splenica','splenic vein':'vena splenica',
 'splenius capitis':M+'splenius capitis','splenius cervicis':M+'splenius cervicis','sternocleidomastoid':M+'sternocleidomastoideus','sternohyoid':M+'sternohyoideus','sternothyroid':M+'sternothyroideus',
 'stylohyoid':M+'stylohyoideus','subclavian artery':'arteria subclavia','subclavian vein':'vena subclavia','subcostal nerve':'nervus subcostalis','submandibular gland':'glandula submandibularis',
 'subscapularis':M+'subscapularis','superficial temporal artery':'arteria temporalis superficialis','superior mesenteric artery':'arteria mesenterica superior','superior mesenteric vein':'vena mesenterica superior',
 'superior rectal artery':'arteria rectalis superior','superior vena cava':'vena cava superior','supraclavicular nerves':'nervi supraclaviculares','sympathetic trunk':'truncus sympathicus',
 'temporalis':M+'temporalis','teres major':M+'teres major','thoracic aorta':'aorta thoracica','thoracolumbar fascia':'fascia thoracolumbalis','thyrohyoid':M+'thyrohyoideus',
 'transversalis fascia':'fascia transversalis','transversus abdominis':M+'transversus abdominis','trapezius':M+'trapezius','vagus nerve':'nervus vagus','zygomaticus major':M+'zygomaticus major','ansa cervicalis':'ansa cervicalis','hypoglossal nerve':'nervus hypoglossus','suprascapular nerve':'nervus suprascapularis','suprascapular artery':'arteria suprascapularis','axillary nerve':'nervus axillaris','teres minor':M+'teres minor','supraspinatus':M+'supraspinatus','long head of triceps':'caput longum musculi tricipitis brachii',
}
ABBR = [('musculus ','m '),('musculi ','mm '),('nervus ','n '),('nervi ','nn '),('arteria ','a '),('arteriae ','aa '),('vena ','v ')]
def apply(D):
    miss=set()
    for pl in D['plates']:
        for p in pl['pins']:
            en=p['answer']
            if 'english' in p or en.startswith(('musculus','musculi')): continue
            if en not in L: miss.add(en); continue
            la=L[en]; also=[a for a in p.get('also',[]) if a!=la]
            short=[la.replace(a,b,1) for a,b in ABBR if la.startswith(a)]
            bare=[la.split(' ',1)[1]] if la.startswith(('musculus ','nervus ','arteria ','vena ')) else []
            p['answer']=la; p['english']=en; p['also']=list(dict.fromkeys(short+bare+[en]+also))
    return miss
if __name__=='__main__':
    D=json.load(open(sys.argv[1])); m=apply(D); json.dump(D,open(sys.argv[1],'w'),indent=1); print('missing',m)
