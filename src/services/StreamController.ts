// ADD 2: Stream Controller - manages stream ownership to prevent orphan streams

export class StreamController {
  private activeStreamByMessageId = new Map<string, string>();
  private activeStreamId: string | null = null;

  start(messageId: string, streamId: string): boolean {
    if (this.activeStreamId && this.activeStreamId !== streamId) {
      // Reject overlapping streams
      return false;
    }
    this.activeStreamByMessageId.set(messageId, streamId);
    this.activeStreamId = streamId;
    return true;
  }

  append(messageId: string, streamId: string): boolean {
    const ownedStream = this.activeStreamByMessageId.get(messageId);
    if (ownedStream !== streamId) {
      // Wrong stream owner
      return false;
    }
    return true;
  }

  end(messageId: string, streamId: string): void {
    this.activeStreamByMessageId.delete(messageId);
    if (this.activeStreamId === streamId) {
      this.activeStreamId = null;
    }
  }

  cancel(streamId: string): void {
    this.activeStreamByMessageId.forEach((ownedStream, msgId) => {
      if (ownedStream === streamId) {
        this.activeStreamByMessageId.delete(msgId);
      }
    });
    if (this.activeStreamId === streamId) {
      this.activeStreamId = null;
    }
  }

  getActiveStream(): string | null {
    return this.activeStreamId;
  }

  isActive(): boolean {
    return this.activeStreamId !== null;
  }
}
