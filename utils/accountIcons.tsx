import React from 'react';
import { WalletIcon } from '../components/icons/WalletIcon';
import { CreditCardIcon } from '../components/icons/CreditCardIcon';
import { BuildingLibraryIcon } from '../components/icons/BuildingLibraryIcon';
import { CashDetailedIcon } from '../components/icons/CashDetailedIcon';
import { BankDetailedIcon } from '../components/icons/BankDetailedIcon';
import { PayPalDetailedIcon } from '../components/icons/PayPalDetailedIcon';
import { CryptoDetailedIcon } from '../components/icons/CryptoDetailedIcon';
import { RevolutDetailedIcon } from '../components/icons/RevolutDetailedIcon';
import { PostePayDetailedIcon } from '../components/icons/PostePayDetailedIcon';
import { CreditCardDetailedIcon } from '../components/icons/CreditCardDetailedIcon';
import { GlobeAltIcon } from '../components/icons/GlobeAltIcon';

export const getAccountIcon = (iconName?: string): React.FC<React.SVGProps<SVGSVGElement>> => {
    switch(iconName) {
        case 'cash': 
            return CashDetailedIcon;
        case 'card': 
        case 'credit-card': 
            return CreditCardDetailedIcon;
        case 'poste':
        case 'postepay':
            return PostePayDetailedIcon;
        case 'bank': 
        case 'bank-account': // Fallback ID
            return BankDetailedIcon;
        case 'paypal':
            return PayPalDetailedIcon;
        case 'crypto':
            return CryptoDetailedIcon;
        case 'revolut':
            return RevolutDetailedIcon;
        case 'online': 
            return GlobeAltIcon;
        default: return WalletIcon;
    }
};
