import React from 'react';
import type { AnalysisEvent } from '../types';
import { NegativeCategory } from '../types';
import { NEGATIVE_BEHAVIOR_SUBCATEGORIES, NEGATIVE_SPEECH_SUBCATEGORIES, POTENTIAL_EMOTIONS_SUBCATEGORIES } from '../constants';
import { SpeechIcon, BehaviorIcon, EmotionIcon } from './icons';

interface MonsterDetectorProps {
    activeDetections: AnalysisEvent[];
}

const CategorySection: React.FC<{
    title: string;
    icon: React.ReactNode;
    subcategories: string[];
    activeSubcategories: Set<string>;
    colorClass: string;
}> = ({ title, icon, subcategories, activeSubcategories, colorClass }) => (
    <div className="bg-white/80 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3 mb-3">
            {icon}
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <ul className="space-y-1.5">
            {subcategories.map(sub => {
                const isActive = activeSubcategories.has(sub);
                return (
                    <li
                        key={sub}
                        className={`text-sm transition-all duration-300 rounded-md px-3 py-1.5 ${
                            isActive
                                ? `${colorClass} text-white font-semibold shadow-lg`
                                : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        {sub}
                    </li>
                );
            })}
        </ul>
    </div>
);

export const MonsterDetector: React.FC<MonsterDetectorProps> = ({ activeDetections }) => {
    const activeSpeech = new Set(
        activeDetections
            .filter(d => d.category === NegativeCategory.SPEECH)
            .map(d => d.subCategory)
    );
    const activeBehavior = new Set(
        activeDetections
            .filter(d => d.category === NegativeCategory.BEHAVIOR)
            .map(d => d.subCategory)
    );
    const activeEmotions = new Set(
        activeDetections
            .filter(d => d.category === NegativeCategory.POTENTIAL_EMOTIONS)
            .map(d => d.subCategory)
    );

    return (
        <div className="bg-white rounded-lg p-4 shadow-xl shadow-gray-200/50 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-center text-red-400">MONSTER DETECTOR ACTIVE</h2>
            <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
                <CategorySection
                    title="Negative Speech"
                    icon={<SpeechIcon />}
                    subcategories={NEGATIVE_SPEECH_SUBCATEGORIES}
                    activeSubcategories={activeSpeech}
                    colorClass="bg-yellow-600"
                />
                <CategorySection
                    title="Negative Behavior"
                    icon={<BehaviorIcon />}
                    subcategories={NEGATIVE_BEHAVIOR_SUBCATEGORIES}
                    activeSubcategories={activeBehavior}
                    colorClass="bg-red-600"
                />
                <CategorySection
                    title="Potential Emotions"
                    icon={<EmotionIcon />}
                    subcategories={POTENTIAL_EMOTIONS_SUBCATEGORIES}
                    activeSubcategories={activeEmotions}
                    colorClass="bg-purple-600"
                />
            </div>
        </div>
    );
};