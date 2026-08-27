"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SearchResult {
  id: string;
  name: string;
  propertyType: string;
  districtId: string;
  location: { area: string; addressLine: string };
  amenities: string[];
  rating: number;
  ratingCount: number;
  startingPrice: number;
  currency: string;
  isAvailable: boolean;
  offers: { name: string; value: number; type: string }[];
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("/api/v1/search");
        const json = await res.json();
        setResults(json.data || []);
      } catch (error) {
        console.error("Failed to fetch search results", error);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-[#0b3b24] text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-[#b4ed50]">Book My Room</Link>
          <nav className="space-x-4">
             <Link href="/auth/login" className="hover:text-[#b4ed50]">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit">
           <h2 className="text-lg font-bold mb-4 text-[#0b3b24]">Filters</h2>
           {/* Filters placeholder */}
           <div className="space-y-4">
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                 <select className="w-full border-gray-300 rounded-md p-2">
                    <option>All Types</option>
                    <option>Hotel</option>
                    <option>Eco Resort</option>
                 </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Amenities</label>
                 <div className="space-y-2">
                    <label className="flex items-center space-x-2"><input type="checkbox" className="rounded text-[#0b3b24] focus:ring-[#b4ed50]" /> <span>AC</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" className="rounded text-[#0b3b24] focus:ring-[#b4ed50]" /> <span>WiFi</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" className="rounded text-[#0b3b24] focus:ring-[#b4ed50]" /> <span>Pool</span></label>
                 </div>
              </div>
           </div>
        </aside>

        <section className="md:col-span-3">
          <div className="flex justify-between items-center mb-6">
             <h1 className="text-2xl font-bold text-[#0b3b24]">Search Results</h1>
             <select className="border-gray-300 rounded-md p-2 text-sm">
                <option value="PRICE_ASC">Price: Low to High</option>
                <option value="PRICE_DESC">Price: High to Low</option>
                <option value="RATING_DESC">Top Rated</option>
             </select>
          </div>

          {loading ? (
             <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b3b24]"></div>
             </div>
          ) : results.length === 0 ? (
             <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-100">
                <p className="text-gray-500">No properties found matching your criteria.</p>
             </div>
          ) : (
             <div className="space-y-4">
               {results.map((prop) => (
                 <div key={prop.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow">
                    <div className="w-full sm:w-64 h-40 bg-gray-200 rounded-lg flex-shrink-0 bg-cover bg-center" style={{backgroundImage: `url(https://ik.imagekit.io/bookmyroom/default-hotel.jpg)`}}></div>
                    <div className="flex-1 flex flex-col justify-between">
                       <div>
                          <div className="flex justify-between items-start">
                            <div>
                               <span className="text-xs font-semibold uppercase tracking-wider text-[#0b3b24]">{prop.propertyType}</span>
                               <h3 className="text-xl font-bold text-gray-900 mt-1">{prop.name}</h3>
                            </div>
                            <div className="bg-[#b4ed50] text-[#0b3b24] px-2 py-1 rounded font-bold text-sm">
                               {prop.rating} ★
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">{prop.location.area}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {prop.amenities.map((am: string) => (
                               <span key={am} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{am}</span>
                            ))}
                          </div>
                       </div>
                       <div className="flex justify-between items-end mt-4">
                          <div>
                             {prop.offers.length > 0 && (
                               <span className="text-xs text-red-600 font-semibold">{prop.offers[0].name} applied</span>
                             )}
                             <p className="text-2xl font-bold text-[#0b3b24]">৳ {prop.startingPrice}</p>
                             <p className="text-xs text-gray-500">Total for selected dates</p>
                          </div>
                          <button className="bg-[#0b3b24] hover:bg-[#1a5c3a] text-white px-6 py-2 rounded-lg font-medium transition-colors">
                            View Details
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </section>
      </main>
    </div>
  );
}
