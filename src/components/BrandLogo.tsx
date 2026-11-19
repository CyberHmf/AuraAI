import React from 'react';
import auraLogoImg from '../assets/images/aura_logo_icon_1794914416143.jpg';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-8 h-8 rounded-xl',
  alt = 'Aura AI',
}) => {
  return (
    <img
      src={auraLogoImg}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`${className} object-cover select-none shrink-0 ring-1 ring-white/10`}
    />
  );
};
