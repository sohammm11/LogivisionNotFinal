import React from 'react';
import { NavLink } from 'react-router-dom';

const MobileBottomTabs = ({ tabs }) => {
  return (
    <div className="absolute bottom-4 left-4 right-4 h-[72px] glass-header border border-[#1E2D45] rounded-[24px] flex items-center justify-around z-50 px-2 shadow-2xl">
      {tabs.map((tab) => {
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.exact}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1 w-full h-full
              ${isActive ? 'text-[#F59E0B]' : 'text-[#6B7FA8]'}
              relative transition-all duration-300
            `}
          >
            {({ isActive }) => {
              const Icon = tab.icon;
              return (
                <>
                  {/* Active Indicator Top Bar */}
                  {isActive && (
                    <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#F59E0B] rounded-full shadow-[0_0_10px_#F59E0B]"></div>
                  )}

                  {tab.badge && (
                    <span className="absolute top-2 right-[calc(50%-22px)] w-4 h-4 bg-[#F43F5E] text-white text-[9px] rounded-full flex justify-center items-center font-black shadow-lg shadow-[#F43F5E]/30 z-10 border border-[#0D1421]">
                      {tab.badge}
                    </span>
                  )}

                  <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-[#F59E0B]/10' : ''}`}>
                    <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                  </div>
                  <span className={`text-[9px] font-black tracking-[0.1em] uppercase ${isActive ? 'opacity-100' : 'opacity-40'}`}>{tab.label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
    </div>
  );
};

export default MobileBottomTabs;
