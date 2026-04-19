import React, { useState } from 'react';
import { Modal } from '../../../components/ui/core/Modal';
import { Input } from '../../../components/ui/core/Input';
import { Button } from '../../../components/ui/core/Button';

interface RenameModalProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  initialName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialName);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Rename Session">
      <div className="p-4">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Session name"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(name)}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};
