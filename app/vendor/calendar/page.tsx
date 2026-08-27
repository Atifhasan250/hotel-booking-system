"use client";

import Link from "next/link";

export default function VendorCalendarPage() {
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Link href="/vendor" className="text-xl font-bold text-[#0b3b24]">Vendor Hub</Link>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <Link href="/vendor/properties" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">Properties</Link>
          <Link href="/vendor/calendar" className="block px-4 py-2 bg-[#f0f9e8] text-[#0b3b24] font-medium rounded">Calendar & Rates</Link>
          <Link href="/vendor/offers" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">Offers</Link>
          <Link href="/vendor/bookings" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded">Bookings</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0b3b24]">Calendar & Rates</h1>
            <p className="text-gray-500 mt-1">Manage room availability and pricing.</p>
          </div>
          <div>
            <select className="border-gray-300 rounded-md p-2 text-sm mr-4">
              <option>Grand Sylhet Hotel</option>
              <option>Sreemangal Eco Resort</option>
            </select>
            <button className="bg-[#0b3b24] hover:bg-[#1a5c3a] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
              Bulk Update
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
             <div className="flex items-center space-x-4">
                <button className="p-1 hover:bg-gray-200 rounded">←</button>
                <span className="font-medium text-lg">August 2026</span>
                <button className="p-1 hover:bg-gray-200 rounded">→</button>
             </div>
             <select className="border-gray-300 rounded-md p-1 text-sm">
                <option>Standard Room</option>
                <option>Deluxe Suite</option>
             </select>
          </div>
          <div className="p-4 overflow-x-auto">
            {/* Calendar Grid Placeholder */}
            <table className="w-full text-sm text-left border-collapse min-w-[800px]">
               <thead>
                 <tr>
                   <th className="border p-2 bg-gray-50 w-32">Metric</th>
                   <th className="border p-2 text-center">Aug 1</th>
                   <th className="border p-2 text-center">Aug 2</th>
                   <th className="border p-2 text-center">Aug 3</th>
                   <th className="border p-2 text-center bg-yellow-50">Aug 4</th>
                   <th className="border p-2 text-center bg-yellow-50">Aug 5</th>
                   <th className="border p-2 text-center">Aug 6</th>
                   <th className="border p-2 text-center">Aug 7</th>
                 </tr>
               </thead>
               <tbody>
                 <tr>
                   <td className="border p-2 font-medium bg-gray-50">Status</td>
                   <td className="border p-2 text-center text-green-600">Open</td>
                   <td className="border p-2 text-center text-green-600">Open</td>
                   <td className="border p-2 text-center text-green-600">Open</td>
                   <td className="border p-2 text-center text-red-600 font-bold bg-yellow-50">Stop Sell</td>
                   <td className="border p-2 text-center text-red-600 font-bold bg-yellow-50">Stop Sell</td>
                   <td className="border p-2 text-center text-green-600">Open</td>
                   <td className="border p-2 text-center text-green-600">Open</td>
                 </tr>
                 <tr>
                   <td className="border p-2 font-medium bg-gray-50">Rooms to sell</td>
                   <td className="border p-2 text-center">5</td>
                   <td className="border p-2 text-center">3</td>
                   <td className="border p-2 text-center">0</td>
                   <td className="border p-2 text-center bg-yellow-50">0</td>
                   <td className="border p-2 text-center bg-yellow-50">0</td>
                   <td className="border p-2 text-center">5</td>
                   <td className="border p-2 text-center">5</td>
                 </tr>
                 <tr>
                   <td className="border p-2 font-medium bg-gray-50">Net Price</td>
                   <td className="border p-2 text-center">৳ 4500</td>
                   <td className="border p-2 text-center">৳ 4500</td>
                   <td className="border p-2 text-center">৳ 5000</td>
                   <td className="border p-2 text-center bg-yellow-50">৳ 5000</td>
                   <td className="border p-2 text-center bg-yellow-50">৳ 5000</td>
                   <td className="border p-2 text-center">৳ 4500</td>
                   <td className="border p-2 text-center">৳ 4500</td>
                 </tr>
                 <tr>
                   <td className="border p-2 font-medium bg-gray-50">Min Stay</td>
                   <td className="border p-2 text-center text-gray-400">1</td>
                   <td className="border p-2 text-center text-gray-400">1</td>
                   <td className="border p-2 text-center text-gray-400">1</td>
                   <td className="border p-2 text-center bg-yellow-50">2</td>
                   <td className="border p-2 text-center bg-yellow-50">2</td>
                   <td className="border p-2 text-center text-gray-400">1</td>
                   <td className="border p-2 text-center text-gray-400">1</td>
                 </tr>
               </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
