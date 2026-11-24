import { useAppState } from '../contexts/AppStateContext';
import { useMemo } from 'react';

export const useFavorites = () => {
    const { state, toggleFavorite } = useAppState();

    const isFavorite = (fileId) => {
        return state.favorites.includes(fileId);
    };

    const favoriteFiles = useMemo(() => {
        return state.files.filter(file => state.favorites.includes(file.id));
    }, [state.files, state.favorites]);

    return {
        favorites: state.favorites,
        favoriteFiles,
        isFavorite,
        toggleFavorite,
    };
};
