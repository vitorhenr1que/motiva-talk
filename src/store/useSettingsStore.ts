import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark'
  fontSize: 'normal' | 'large' | 'extra-large'
  
  toggleTheme: () => void
  setFontSize: (size: SettingsState['fontSize']) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 'normal',

      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),

      setFontSize: (fontSize) => set({ fontSize }),
    }),
    {
      name: 'motiva-talk-settings', // name of the item in storage
    }
  )
)
