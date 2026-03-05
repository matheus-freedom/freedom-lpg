
import React from 'react';

interface FredGuideProps {
  message: string;
}

const FredGuide: React.FC<FredGuideProps> = ({ message }) => {
  return (
    <div className="flex items-start space-x-4 p-4 bg-white rounded-2xl shadow-sm border-l-4 border-freedom-orange mb-6">
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-freedom-orange flex items-center justify-center text-white shadow-sm relative">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="relative inline-flex rounded-full h-4 w-4 bg-white border-2 border-freedom-orange"></span>
        </span>
      </div>
      <div className="flex-1">
        <p className="font-title text-freedom-orange text-[10px] mb-1 uppercase tracking-[0.2em] font-black">Fred says:</p>
        <p className="text-freedom-gray leading-relaxed italic text-sm font-medium">"{message}"</p>
      </div>
    </div>
  );
};

export default FredGuide;
