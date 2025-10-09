import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './components/Home';
import TourCatalog from './components/TourCatalog';
import TourDetail from './components/TourDetail';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import VisaSupport from './components/VisaSupport';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tours" element={<TourCatalog />} />
              <Route path="/tours/:id" element={<TourDetail />} />
              <Route path="/visa-support" element={<VisaSupport />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;