
import React from 'react';
import { AllIcon } from '../components/icons/categories/AllIcon';
import { FoodIcon } from '../components/icons/categories/FoodIcon';
import { TransportIcon } from '../components/icons/categories/TransportIcon';
import { HomeIcon } from '../components/icons/categories/HomeIcon';
import { ShoppingIcon } from '../components/icons/categories/ShoppingIcon';
import { LeisureIcon } from '../components/icons/categories/LeisureIcon';
import { HealthIcon } from '../components/icons/categories/HealthIcon';
import { EducationIcon } from '../components/icons/categories/EducationIcon';
import { WorkIcon } from '../components/icons/categories/WorkIcon';
import { CharityIcon } from '../components/icons/categories/CharityIcon';
import { OtherIcon } from '../components/icons/categories/OtherIcon';

interface CategoryStyle {
    label: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
    bgColor: string;
}

export const categoryStyles: Record<string, CategoryStyle> = {
    'all': {
        label: 'Tutte',
        Icon: AllIcon,
        color: 'text-slate-600',
        bgColor: 'bg-slate-200',
    },
    'Alimentari': {
        label: 'Alimentari',
        Icon: FoodIcon,
        color: 'text-lime-600', // Verde Chiaro (Lime)
        bgColor: 'bg-lime-100',
    },
    'Trasporti': {
        label: 'Trasporti',
        Icon: TransportIcon,
        color: 'text-slate-600', // Grigio (Slate)
        bgColor: 'bg-slate-100',
    },
    'Casa': {
        label: 'Casa',
        Icon: HomeIcon,
        color: 'text-blue-900', // Blu scuro
        bgColor: 'bg-blue-100',
    },
    'Shopping': {
        label: 'Shopping',
        Icon: ShoppingIcon,
        color: 'text-purple-600', // Viola
        bgColor: 'bg-purple-100',
    },
    'Tempo Libero': {
        label: 'Tempo Libero',
        Icon: LeisureIcon,
        color: 'text-yellow-600', // Giallo
        bgColor: 'bg-yellow-100',
    },
    'Salute': {
        label: 'Salute',
        Icon: HealthIcon,
        color: 'text-cyan-600', // Azzurro (Cyan)
        bgColor: 'bg-cyan-100',
    },
    'Istruzione': {
        label: 'Istruzione',
        Icon: EducationIcon,
        color: 'text-green-600', // Verde
        bgColor: 'bg-green-100',
    },
    'Lavoro': {
        label: 'Lavoro',
        Icon: WorkIcon,
        color: 'text-blue-600', // Blu
        bgColor: 'bg-blue-100',
    },
    'Beneficienza': {
        label: 'Beneficienza',
        Icon: CharityIcon,
        color: 'text-red-600', // Rosso
        bgColor: 'bg-red-100',
    },
    'Altro': {
        label: 'Altro',
        Icon: OtherIcon,
        color: 'text-amber-900', // Marrone (Amber-900 is brownish)
        bgColor: 'bg-amber-100',
    },
};

export const getCategoryStyle = (category: string | 'all'): CategoryStyle => {
    return categoryStyles[category] || categoryStyles['Altro'];
};
