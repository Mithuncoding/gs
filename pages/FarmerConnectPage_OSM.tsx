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

// Sample farmer locations in Karnataka
const farmerLocations: FarmerLocation[] = [
  { id: 1, name: "Manjunath Farm", nameKn: "ಮಂಜುನಾಥ ಫಾರ್ಮ್", type: "Organic Vegetables", typeKn: "ಸಾವಯವ ತರಕಾರಿಗಳು", lat: 12.9716, lng: 77.5946, contact: "9876543210", products: "Tomato, Onion, Potato", productsKn: "ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಆಲೂಗಡ್ಡೆ" },
  { id: 2, name: "Krishna Dairy", nameKn: "ಕೃಷ್ಣ ಡೈರಿ", type: "Dairy Products", typeKn: "ಡೈರಿ ಉತ್ಪನ್ನಗಳು", lat: 12.9141, lng: 77.5814, contact: "9876543211", products: "Milk, Curd, Ghee", productsKn: "ಹಾಲು, ಮೊಸರು, ತುಪ್ಪ" },
  { id: 3, name: "Shivappa's Fruits", nameKn: "ಶಿವಪ್ಪನ ಹಣ್ಣುಗಳು", type: "Fresh Fruits", typeKn: "ತಾಜಾ ಹಣ್ಣುಗಳು", lat: 13.0339, lng: 77.5973, contact: "9876543212", products: "Mango, Banana, Papaya", productsKn: "ಮಾವಿನ ಹಣ್ಣು, ಬಾಳೆಹಣ್ಣು, ಪಪ್ಪಾಯ" },
  { id: 4, name: "Lakshmi Grains", nameKn: "ಲಕ್ಷ್ಮೀ ಧಾನ್ಯಗಳು", type: "Grains & Pulses", typeKn: "ಧಾನ್ಯ ಮತ್ತು ದಾಲ್", lat: 13.0057, lng: 77.5647, contact: "9876543213", products: "Rice, Wheat, Dal", productsKn: "ಅಕ್ಕಿ, ಗೋಧಿ, ದಾಲ್" },
  { id: 5, name: "Ravi's Flowers", nameKn: "ರವಿಯ ಹೂವುಗಳು", type: "Flowers", typeKn: "ಹೂವುಗಳು", lat: 12.9599, lng: 77.7040, contact: "9876543214", products: "Rose, Jasmine, Marigold", productsKn: "ಗುಲಾಬಿ, ಮಲ್ಲಿಗೆ, ಶೆವಂತಿಗೆ" }
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
  const [userLocation, setUserLocation] = useState<[number, number]>([12.9716, 77.5946]); // Bangalore default
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
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

        {/* Map */}
        <Card className="mb-4 overflow-hidden">
          <div style={{ height: '400px', width: '100%' }}>
            <MapContainer
              center={userLocation}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={userLocation} />
              
              {/* User location marker */}
              <Marker position={userLocation}>
                <Popup>
                  <div className="text-center font-semibold">
                    📍 {text.myLocation}
                  </div>
                </Popup>
              </Marker>

              {/* Farmer markers */}
              {filteredFarmers.map(farmer => (
                <Marker
                  key={farmer.id}
                  position={[farmer.lat, farmer.lng]}
                  eventHandlers={{
                    click: () => setSelectedFarmer(farmer)
                  }}
                >
                  <Popup>
                    <div className="text-center">
                      <h3 className="font-bold text-lg mb-1">
                        {language === 'kn' ? farmer.nameKn : farmer.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {language === 'kn' ? farmer.typeKn : farmer.type}
                      </p>
                      <button
                        onClick={() => setSelectedFarmer(farmer)}
                        className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-green-600"
                      >
                        {language === 'kn' ? 'ವಿವರಗಳು' : 'Details'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Farmer List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFarmers.length > 0 ? (
            filteredFarmers.map(farmer => (
              <Card
                key={farmer.id}
                className={`cursor-pointer transition-all ${
                  selectedFarmer?.id === farmer.id ? 'ring-4 ring-green-500' : ''
                }`}
                onClick={() => setSelectedFarmer(farmer)}
              >
                <div className="p-4">
                  <h3 className="text-xl font-bold text-green-800 mb-2">
                    {language === 'kn' ? farmer.nameKn : farmer.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">{text.type}:</span>{' '}
                    {language === 'kn' ? farmer.typeKn : farmer.type}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">{text.products}:</span>{' '}
                    {language === 'kn' ? farmer.productsKn : farmer.products}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-semibold">{text.contact}:</span>{' '}
                    <a href={`tel:${farmer.contact}`} className="text-green-600 hover:underline">
                      {farmer.contact}
                    </a>
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      getDirections(farmer);
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-4 rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition-all"
                  >
                    🗺️ {text.getDirections}
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">{text.noResults}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerConnectPage;
