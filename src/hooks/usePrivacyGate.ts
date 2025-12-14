
import { useState } from 'react';

export const usePrivacyGate = () => {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [isPinVerifierOpen, setIsPinVerifierOpen] = useState(false);

  const handleToggleBalanceVisibility = () => {
      if (isBalanceVisible) {
          setIsBalanceVisible(false);
      } else {
          setIsPinVerifierOpen(true);
      }
  };

  const handlePinVerified = () => {
      setIsPinVerifierOpen(false);
      setIsBalanceVisible(true);
  };

  return {
    isBalanceVisible,
    isPinVerifierOpen,
    setIsPinVerifierOpen,
    handleToggleBalanceVisibility,
    handlePinVerified
  };
};
