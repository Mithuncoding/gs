import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/Card';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom farmer icon - using URL encoding instead of btoa to support emojis
const farmerIcon = L.icon({
  iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="22" fill="#22c55e" stroke="#fff" stroke-width="4"/>
      <circle cx="25" cy="25" r="18" fill="#16a34a"/>
      <path d="M 25 10 L 28 20 L 38 20 L 30 26 L 33 36 L 25 30 L 17 36 L 20 26 L 12 20 L 22 20 Z" fill="#fbbf24" stroke="#fff" stroke-width="1"/>
    </svg>
  `),
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50]
});

// Custom user location icon - using URL encoding
const userIcon = L.icon({
  iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="22" fill="#3b82f6" stroke="#fff" stroke-width="4"/>
      <circle cx="25" cy="25" r="18" fill="#2563eb"/>
      <circle cx="25" cy="25" r="8" fill="#fff"/>
      <circle cx="25" cy="25" r="4" fill="#3b82f6"/>
    </svg>
  `),
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50]
});

interface FarmerLocation {
  id: number;
  name: string;
  nameKn: string;
  type: string;
  typeKn: string;
  lat: number;
  lng: number;
  contact: string;
  products: string;
  productsKn: string;
}

// Farmer locations near Kengeri, Bangalore (SJBIT area)
const farmerLocations: FarmerLocation[] = [
  // Kengeri area farmers
  { id: 1, name: "Manjunath Organic Farm", nameKn: "ಮಂಜುನಾಥ ಸಾವಯವ ಫಾರ್ಮ್", type: "Organic Vegetables", typeKn: "ಸಾವಯವ ತರಕಾರಿಗಳು", lat: 12.9088, lng: 77.4854, contact: "9876543210", products: "Tomato, Onion, Potato, Carrot", productsKn: "ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಆಲೂಗಡ್ಡೆ, ಕ್ಯಾರೆಟ್" },
  { id: 2, name: "Krishna Dairy Farm", nameKn: "ಕೃಷ್ಣ ಡೈರಿ ಫಾರ್ಮ್", type: "Dairy Products", typeKn: "ಡೈರಿ ಉತ್ಪನ್ನಗಳು", lat: 12.9156, lng: 77.4890, contact: "9876543211", products: "Fresh Milk, Curd, Ghee, Paneer", productsKn: "ತಾಜಾ ಹಾಲು, ಮೊಸರು, ತುಪ್ಪ, ಪನೀರ್" },
  { id: 3, name: "Shivappa's Fruit Garden", nameKn: "ಶಿವಪ್ಪನ ಹಣ್ಣಿನ ತೋಟ", type: "Fresh Fruits", typeKn: "ತಾಜಾ ಹಣ್ಣುಗಳು", lat: 12.9045, lng: 77.4920, contact: "9876543212", products: "Mango, Banana, Papaya, Guava", productsKn: "ಮಾವಿನ ಹಣ್ಣು, ಬಾಳೆಹಣ್ಣು, ಪಪ್ಪಾಯ, ಪೇರಲ" },
  { id: 4, name: "Lakshmi Grains & Pulses", nameKn: "ಲಕ್ಷ್ಮೀ ಧಾನ್ಯ ಮತ್ತು ದಾಲ್", type: "Grains & Pulses", typeKn: "ಧಾನ್ಯ ಮತ್ತು ದಾಲ್", lat: 12.9120, lng: 77.4950, contact: "9876543213", products: "Rice, Wheat, Dal, Ragi", productsKn: "ಅಕ್ಕಿ, ಗೋಧಿ, ದಾಲ್, ರಾಗಿ" },
  { id: 5, name: "Ravi's Flower Market", nameKn: "ರವಿಯ ಹೂವಿನ ಮಾರುಕಟ್ಟೆ", type: "Fresh Flowers", typeKn: "ತಾಜಾ ಹೂವುಗಳು", lat: 12.9065, lng: 77.4800, contact: "9876543214", products: "Rose, Jasmine, Marigold, Chrysanthemum", productsKn: "ಗುಲಾಬಿ, ಮಲ್ಲಿಗೆ, ಶೆವಂತಿಗೆ, ಸೇವಂತಿಗೆ" },
  
  // Near Ullal & RR Nagar
  { id: 6, name: "Nagaraj Vegetable Farm", nameKn: "ನಾಗರಾಜ್ ತರಕಾರಿ ತೋಟ", type: "Seasonal Vegetables", typeKn: "ಕಾಲೋಚಿತ ತರಕಾರಿಗಳು", lat: 12.9200, lng: 77.4920, contact: "9876543215", products: "Beans, Peas, Cabbage, Cauliflower", productsKn: "ಹುರುಳಿಕಾಯಿ, ಬಟಾಣಿ, ಎಲೆಕೋಸು, ಹೂಕೋಸು" },
  { id: 7, name: "Venkatesh Chicken Farm", nameKn: "ವೆಂಕಟೇಶ್ ಕೋಳಿ ಫಾರ್ಮ್", type: "Poultry & Eggs", typeKn: "ಕೋಳಿ ಮತ್ತು ಮೊಟ್ಟೆಗಳು", lat: 12.9180, lng: 77.5000, contact: "9876543216", products: "Fresh Eggs, Country Chicken", productsKn: "ತಾಜಾ ಮೊಟ್ಟೆಗಳು, ನಾಟಿ ಕೋಳಿ" },
  { id: 8, name: "Suresh Coconut Grove", nameKn: "ಸುರೇಶ್ ತೆಂಗಿನ ತೋಪು", type: "Coconut Products", typeKn: "ತೆಂಗಿನಕಾಯಿ ಉತ್ಪನ್ನಗಳು", lat: 12.9000, lng: 77.4880, contact: "9876543217", products: "Coconut, Coconut Oil, Copra", productsKn: "ತೆಂಗಿನಕಾಯಿ, ತೆಂಗಿನ ಎಣ್ಣೆ, ಕೊಪ್ರಾ" },
  
  // Towards Mysore Road
  { id: 9, name: "Ramesh Spice Farm", nameKn: "ರಮೇಶ್ ಮಸಾಲೆ ತೋಟ", type: "Spices & Herbs", typeKn: "ಮಸಾಲೆಗಳು ಮತ್ತು ಗಿಡಮೂಲಿಕೆಗಳು", lat: 12.9010, lng: 77.4760, contact: "9876543218", products: "Turmeric, Chili, Coriander, Curry Leaves", productsKn: "ಅರಿಶಿನ, ಮೆಣಸಿನಕಾಯಿ, ಕೊತ್ತಂಬರಿ, ಕರಿಬೇವು" },
  { id: 10, name: "Gowda's Green Farm", nameKn: "ಗೌಡರ ಹಸಿರು ತೋಟ", type: "Leafy Vegetables", typeKn: "ಎಲೆಕೋಸು ತರಕಾರಿಗಳು", lat: 12.8980, lng: 77.4820, contact: "9876543219", products: "Spinach, Fenugreek, Mint, Coriander", productsKn: "ಪಾಲಕ್, ಮೆಂತೆ, ಪುದೀನ, ಕೊತ್ತಂಬರಿ" },
  
  // Near Rajarajeshwari Nagar
  { id: 11, name: "Basavaraj Banana Farm", nameKn: "ಬಸವರಾಜ್ ಬಾಳೆ ತೋಟ", type: "Banana Plantation", typeKn: "ಬಾಳೆ ತೋಟ", lat: 12.9220, lng: 77.5050, contact: "9876543220", products: "Banana, Plantain, Banana Flowers", productsKn: "ಬಾಳೆಹಣ್ಣು, ನೇಂತ್ರ, ಬಾಳೆ ಹೂವು" },
  { id: 12, name: "Savitha Nursery", nameKn: "ಸವಿತಾ ನರ್ಸರಿ", type: "Plants & Seeds", typeKn: "ಸಸ್ಯಗಳು ಮತ್ತು ಬೀಜಗಳು", lat: 12.9250, lng: 77.5020, contact: "9876543221", products: "Saplings, Seeds, Fertilizers", productsKn: "ಸಸಿಗಳು, ಬೀಜಗಳು, ಗೊಬ್ಬರಗಳು" },
  
  // Towards Magadi Road
  { id: 13, name: "Kumar Sugarcane Farm", nameKn: "ಕುಮಾರ್ ಕಬ್ಬಿನ ತೋಟ", type: "Sugarcane & Jaggery", typeKn: "ಕಬ್ಬು ಮತ್ತು ಬೆಲ್ಲ", lat: 12.9140, lng: 77.4700, contact: "9876543222", products: "Sugarcane, Jaggery, Sugarcane Juice", productsKn: "ಕಬ್ಬು, ಬೆಲ್ಲ, ಕಬ್ಬಿನ ರಸ" },
  { id: 14, name: "Prakash Mushroom Farm", nameKn: "ಪ್ರಕಾಶ್ ಅಣಬೆ ತೋಟ", type: "Mushroom Cultivation", typeKn: "ಅಣಬೆ ಕೃಷಿ", lat: 12.9100, lng: 77.4750, contact: "9876543223", products: "Button Mushroom, Oyster Mushroom", productsKn: "ಬಟನ್ ಅಣಬೆ, ಆಯ್ಸ್ಟರ್ ಅಣಬೆ" },
  
  // Near Nagasandra
  { id: 15, name: "Anand Hydroponics", nameKn: "ಅನಂದ್ ಹೈಡ್ರೋಪಾನಿಕ್ಸ್", type: "Hydroponic Vegetables", typeKn: "ಹೈಡ್ರೋಪಾನಿಕ್ ತರಕಾರಿಗಳು", lat: 12.9300, lng: 77.4850, contact: "9876543224", products: "Lettuce, Tomato, Cucumber, Bell Pepper", productsKn: "ಲೆಟಿಸ್, ಟೊಮೇಟೊ, ಸೌತೆಕಾಯಿ, ಕ್ಯಾಪ್ಸಿಕಂ" }
];

// Component to recenter map
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const FarmerConnectPage: React.FC = () => {
  const { language } = useLanguage();
  const [userLocation, setUserLocation] = useState<[number, number]>([12.9088, 77.4854]); // Kengeri, Bangalore (SJBIT area)
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerLocation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const t = {
    en: {
      title: 'Farmer Connect',
      subtitle: 'Connect with local farmers and suppliers',
      myLocation: 'My Location',
      findFarmers: 'Find Farmers Near You',
      search: 'Search by name, product, or type...',
      contact: 'Contact',
      products: 'Products',
      getDirections: 'Get Directions',
      type: 'Type',
      noResults: 'No farmers found matching your search'
    },
    kn: {
      title: 'ರೈತ ಸಂಪರ್ಕ',
      subtitle: 'ಸ್ಥಳೀಯ ರೈತರು ಮತ್ತು ಪೂರೈಕೆದಾರರೊಂದಿಗೆ ಸಂಪರ್ಕ',
      myLocation: 'ನನ್ನ ಸ್ಥಳ',
      findFarmers: 'ನಿಮ್ಮ ಸಮೀಪದಲ್ಲಿ ರೈತರನ್ನು ಹುಡುಕಿ',
      search: 'ಹೆಸರು, ಉತ್ಪನ್ನ ಅಥವಾ ವಿಧದಿಂದ ಹುಡುಕಿ...',
      contact: 'ಸಂಪರ್ಕ',
      products: 'ಉತ್ಪನ್ನಗಳು',
      getDirections: 'ನಿರ್ದೇಶನಗಳನ್ನು ಪಡೆಯಿರಿ',
      type: 'ವಿಧ',
      noResults: 'ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಹೊಂದಿಕೆಯಾಗುವ ರೈತರು ಕಂಡುಬಂದಿಲ್ಲ'
    }
  };

  const text = t[language as 'en' | 'kn'] || t.en;

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Filter farmers based on search
  const filteredFarmers = farmerLocations.filter(farmer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      farmer.name.toLowerCase().includes(searchLower) ||
      farmer.nameKn.includes(searchTerm) ||
      farmer.type.toLowerCase().includes(searchLower) ||
      farmer.typeKn.includes(searchTerm) ||
      farmer.products.toLowerCase().includes(searchLower) ||
      farmer.productsKn.includes(searchTerm)
    );
  });

  const getDirections = (farmer: FarmerLocation) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation[0]},${userLocation[1]}&destination=${farmer.lat},${farmer.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-green-800 mb-2">{text.title}</h1>
          <p className="text-lg text-green-600">{text.subtitle}</p>
        </div>

        {/* Search Bar */}
        <Card className="mb-4">
          <div className="p-4">
            <input
              type="text"
              placeholder={text.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-green-300 rounded-xl focus:outline-none focus:border-green-500 text-lg"
            />
          </div>
        </Card>

        {/* Map - HUGE & FULL SCREEN */}
        <Card className="mb-6 overflow-hidden shadow-2xl">
          <div className="h-[600px] md:h-[700px] lg:h-[800px] w-full">
            <MapContainer
              center={userLocation}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <RecenterMap center={userLocation} />
              
              {/* User location marker */}
              <Marker position={userLocation} icon={userIcon}>
                <Popup>
                  <div className="text-center font-semibold text-lg">
                    📍 {text.myLocation}
                  </div>
                </Popup>
              </Marker>

              {/* Farmer markers */}
              {filteredFarmers.map(farmer => (
                <Marker
                  key={farmer.id}
                  position={[farmer.lat, farmer.lng]}
                  icon={farmerIcon}
                  eventHandlers={{
                    click: () => setSelectedFarmer(farmer)
                  }}
                >
                  <Popup>
                    <div className="text-center p-2 min-w-[200px]">
                      <div className="text-3xl mb-2">🌾</div>
                      <h3 className="font-bold text-xl mb-2 text-green-800">
                        {language === 'kn' ? farmer.nameKn : farmer.name}
                      </h3>
                      <p className="text-sm text-gray-700 mb-1 font-semibold bg-green-100 px-3 py-1 rounded-full">
                        {language === 'kn' ? farmer.typeKn : farmer.type}
                      </p>
                      <p className="text-xs text-gray-600 mb-3 mt-2">
                        📦 {language === 'kn' ? farmer.productsKn : farmer.products}
                      </p>
                      <button
                        onClick={() => setSelectedFarmer(farmer)}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg w-full"
                      >
                        {language === 'kn' ? '📞 ವಿವರಗಳು' : '📞 View Details'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Farmer List - HUGE CARDS */}
        <div className="mt-8">
          <h2 className="text-3xl font-bold text-green-800 mb-6 text-center">
            🌾 {language === 'kn' ? 'ಎಲ್ಲಾ ರೈತರು' : 'All Farmers Near You'}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFarmers.length > 0 ? (
              filteredFarmers.map(farmer => (
                <Card
                  key={farmer.id}
                  className={`cursor-pointer transition-all transform hover:scale-105 hover:shadow-2xl ${
                    selectedFarmer?.id === farmer.id ? 'ring-4 ring-green-500 shadow-2xl scale-105' : ''
                  }`}
                  onClick={() => setSelectedFarmer(farmer)}
                >
                  <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="text-5xl mb-4 text-center">🌾</div>
                    <h3 className="text-2xl font-bold text-green-800 mb-3 text-center">
                      {language === 'kn' ? farmer.nameKn : farmer.name}
                    </h3>
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-inner">
                      <p className="text-base text-gray-700 mb-3 flex items-center">
                        <span className="font-bold text-green-700 mr-2">🏷️ {text.type}:</span>
                        <span className="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold">
                          {language === 'kn' ? farmer.typeKn : farmer.type}
                        </span>
                      </p>
                      <p className="text-sm text-gray-700 mb-3 flex items-start">
                        <span className="font-bold text-green-700 mr-2 mt-1">📦 {text.products}:</span>
                        <span className="flex-1">{language === 'kn' ? farmer.productsKn : farmer.products}</span>
                      </p>
                      <p className="text-base text-gray-700 mb-0 flex items-center">
                        <span className="font-bold text-green-700 mr-2">📞 {text.contact}:</span>
                        <a 
                          href={`tel:${farmer.contact}`} 
                          className="text-blue-600 hover:underline font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {farmer.contact}
                        </a>
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        getDirections(farmer);
                      }}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      🗺️ {text.getDirections}
                    </button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 text-2xl font-semibold">{text.noResults}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerConnectPage;
