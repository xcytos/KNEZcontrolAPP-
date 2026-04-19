import React from 'react';
import { Modal } from '../../../components/ui/core/Modal';
import { Button } from '../../../components/ui/core/Button';

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ForkModal: React.FC<ForkModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Fork Session">
      <div className="p-4">
        <p className="text-sm text-zinc-400 mb-6">
          Create a new session branching from this point? The current session history will be preserved.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Fork Session
          </Button>
        </div>
      </div>
    </Modal>
  );
};
