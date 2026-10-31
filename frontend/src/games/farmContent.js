export const CROPS = {
  tomato: {
    id: 'tomato',
    name: { ne: 'गोलभेंडा', en: 'Tomato' },
    seedName: { ne: 'गोलभेंडा बिउ', en: 'Tomato seeds' },
    daysToMaturity: 12,
    targetMoisture: [32, 76],
    stages: [
      { at: 0, key: 'seed', ne: 'बिउ', en: 'Seed' },
      { at: 1, key: 'germination', ne: 'टुसाउँदै', en: 'Germinating' },
      { at: 3, key: 'seedling', ne: 'बिरुवा', en: 'Seedling' },
      { at: 5, key: 'vegetative', ne: 'पात बढ्दै', en: 'Leaf growth' },
      { at: 8, key: 'flowering', ne: 'फूल फुल्दै', en: 'Flowering' },
      { at: 10, key: 'fruiting', ne: 'फल लाग्दै', en: 'Fruiting' },
      { at: 12, key: 'ready', ne: 'पाकेको', en: 'Ripe' }
    ]
  },
  potato: {
    id: 'potato',
    name: { ne: 'आलु', en: 'Potato' },
    seedName: { ne: 'आलुको बिउ', en: 'Potato seed' },
    daysToMaturity: 15,
    targetMoisture: [28, 70],
    stages: [
      { at: 0, key: 'seed', ne: 'बिउ', en: 'Seed' },
      { at: 2, key: 'sprout', ne: 'उम्रिँदै', en: 'Sprouting' },
      { at: 4, key: 'vegetative', ne: 'पात बढ्दै', en: 'Leaf growth' },
      { at: 8, key: 'tuber', ne: 'कन्द बन्दै', en: 'Tuber forming' },
      { at: 12, key: 'maturation', ne: 'परिपक्व', en: 'Maturing' },
      { at: 15, key: 'ready', ne: 'पाकेको', en: 'Ripe' }
    ]
  },
  rice: {
    id: 'rice',
    name: { ne: 'धान', en: 'Rice' },
    seedName: { ne: 'धानको बिउ', en: 'Rice seed' },
    daysToMaturity: 18,
    targetMoisture: [55, 90],
    stages: [
      { at: 0, key: 'seed', ne: 'बिउ', en: 'Seed' },
      { at: 2, key: 'germination', ne: 'टुसाउँदै', en: 'Germinating' },
      { at: 4, key: 'seedling', ne: 'बिरुवा', en: 'Seedling' },
      { at: 7, key: 'tillering', ne: 'कमिला लाग्दै', en: 'Tillering' },
      { at: 12, key: 'heading', ne: 'बाला लाग्दै', en: 'Heading' },
      { at: 15, key: 'ripening', ne: 'पाक्दै', en: 'Ripening' },
      { at: 18, key: 'ready', ne: 'पाकेको', en: 'Ripe' }
    ]
  },
  maize: {
    id: 'maize',
    name: { ne: 'मकै', en: 'Maize' },
    seedName: { ne: 'मकैको बिउ', en: 'Maize seed' },
    daysToMaturity: 14,
    targetMoisture: [35, 72],
    stages: [
      { at: 0, key: 'seed', ne: 'बिउ', en: 'Seed' },
      { at: 2, key: 'germination', ne: 'टुसाउँदै', en: 'Germinating' },
      { at: 3, key: 'seedling', ne: 'बिरुवा', en: 'Seedling' },
      { at: 6, key: 'vegetative', ne: 'पात बढ्दै', en: 'Leaf growth' },
      { at: 10, key: 'tasseling', ne: 'फूल आउँदै', en: 'Tasseling' },
      { at: 11, key: 'silking', ne: 'रेशम आउँदै', en: 'Silking' },
      { at: 14, key: 'ready', ne: 'पाकेको', en: 'Ripe' }
    ]
  }
};

export const FIELDS = [
  {
    id: 'sunny-terrace',
    name: { ne: 'घाम लाग्ने पाखोबारी', en: 'Sunny hillside terrace' },
    description: { ne: 'घमाइला दिनमा माटोको चिस्यान छिटो घट्छ।', en: 'Soil dries faster on sunny days in this game.' },
    icon: 'sun',
    unlockedAfterHarvests: 0,
    extraSunnyDrying: 3,
    extraRainRetention: 0
  },
  {
    id: 'sheltered-plot',
    name: { ne: 'ओतिलो तल्लो बारी', en: 'Sheltered lower plot' },
    description: { ne: 'वर्षापछि चिस्यान केही लामो समय रहन्छ।', en: 'Soil stays wetter after rain in this game.' },
    icon: 'cloud',
    unlockedAfterHarvests: 1,
    extraSunnyDrying: 0,
    extraRainRetention: 4
  },
  {
    id: 'irrigated-paddy',
    name: { ne: 'सिँचित धानखेत', en: 'Irrigated paddy field' },
    description: { ne: 'यहाँ माटो धेरै चिस्यान राख्न सक्छ। धानका लागि उत्तम।', en: 'Soil holds moisture very well here. Ideal for rice in this game.' },
    icon: 'droplets',
    unlockedAfterHarvests: 3,
    extraSunnyDrying: 0,
    extraRainRetention: 8
  },
  {
    id: 'greenhouse-plot',
    name: { ne: 'ग्रिनहाउस बारी', en: 'Greenhouse plot' },
    description: { ne: 'नियन्त्रित वातावरण। वर्षा र चिस्यानको उतारचढाव कम हुन्छ।', en: 'Controlled environment. Rainfall and moisture swings are reduced in this game.' },
    icon: 'warehouse',
    unlockedAfterHarvests: 5,
    extraSunnyDrying: 0,
    extraRainRetention: 0,
    weatherDampening: true
  }
];

export const SKILLS = [
  { id: 'soil', ne: 'माटो तयारी', en: 'Soil care' },
  { id: 'water', ne: 'पानी व्यवस्थापन', en: 'Water management' },
  { id: 'cropCare', ne: 'बाली हेरचाह', en: 'Crop care' },
  { id: 'harvest', ne: 'भित्र्याइ', en: 'Harvest' },
  { id: 'market', ne: 'बजार निर्णय', en: 'Market choices' },
  { id: 'nutrition', ne: 'पोषण व्यवस्थापन', en: 'Nutrition management' }
];

export const BADGES = {
  'first-harvest': { ne: 'पहिलो बाली', en: 'First harvest' },
  'careful-grower': { ne: 'धैर्यवान किसान', en: 'Careful grower' },
  'first-sale': { ne: 'पहिलो बिक्री', en: 'First sale' },
  'home-harvest': { ne: 'घरको ताजा बाली', en: 'Fresh food at home' },
  'first-potato': { ne: 'पहिलो आलु', en: 'First potato harvest' },
  'first-rice': { ne: 'पहिलो धान', en: 'First rice harvest' },
  'first-maize': { ne: 'पहिलो मकै', en: 'First maize harvest' },
  'three-crops': { ne: 'तीन बाली किसान', en: 'Three-crop farmer' },
  'greenhouse-grower': { ne: 'ग्रिनहाउस किसान', en: 'Greenhouse grower' },
  'nutritionist': { ne: 'पोषण विशेषज्ञ', en: 'Nutritionist' }
};

export const TUTORIAL_STEPS = [
  {
    icon: 'handshake',
    title: { ne: 'नमस्कार, किसान साथी!', en: 'Welcome, farmer!' },
    body: { ne: 'यो कास्कीको पहाडी परिवेशमा आधारित सिकाइ खेल हो। माटो र मौसम हेरेर आफ्नै गतिमा निर्णय गर्नुहोस्।', en: 'This learning game is set in a Kaski hillside farm. Read the field and weather, then make choices at your own pace.' }
  },
  {
    icon: 'map',
    title: { ne: 'आफ्नो बारी छान्नुहोस्', en: 'Choose a field' },
    body: { ne: 'खुला बारी छान्नुहोस्। नयाँ बारी पहिलो सिजन भित्र्याएपछि खुल्छ।', en: 'Choose an available plot. A second plot unlocks after your first harvest.' }
  },
  {
    icon: 'sprout',
    title: { ne: 'माटो तयार गरी बिउ रोप्नुहोस्', en: 'Prepare and plant' },
    body: { ne: 'पहिले बेड तयार गर्नुहोस्, त्यसपछि बीउ सूचीबाट बाली छानेर रोप्नुहोस्।', en: 'Prepare the bed, then select a seed from your inventory and plant it.' }
  },
  {
    icon: 'droplet',
    title: { ne: 'हरेक दिन खेत हेर्नुहोस्', en: 'Check the field each day' },
    body: { ne: 'चिस्यान, झारपात र मौसम हेर्नुहोस्। हतार छैन—तयार भएपछि मात्र अर्को दिन जानुहोस्।', en: 'Check moisture, weeds and weather. There is no timer; advance only when you are ready.' }
  },
  {
    icon: 'basket',
    title: { ne: 'बाली भित्र्याएर निर्णय गर्नुहोस्', en: 'Harvest and choose what to do' },
    body: { ne: 'पाकेको बाली टिप्नुहोस्, केही खेल सिक्का पाएर बेच्नुहोस् वा घरमा राख्नुहोस्। त्यसपछि अर्को सिजन सुरु गर्न सक्नुहुन्छ।', en: 'Pick ripe produce, sell it for game coins or keep it for home. Then you can start another season.' }
  },
  {
    icon: 'leaf',
    title: { ne: 'बाली छान्नुहोस्', en: 'Choose your crop' },
    body: { ne: 'गोलभेंडा, आलु, धान वा मकैबाट सुरु गर्नुहोस्। हरेक बालीको फरक चिस्यान र मौसम आवश्यकता हुन्छ।', en: 'Start with tomato, potato, rice or maize. Each crop has different moisture and weather needs.' }
  }
];