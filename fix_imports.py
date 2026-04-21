import os
import re
from pathlib import Path

def fix_imports():
    """Fix import paths after services modularization"""
    src_dir = Path("src")
    
    # Define replacements - handle both single and double quotes, different path depths
    replacements = [
        # KnezClient
        (r"from ['\"]\.\.?/\.\.?/services/KnezClient['\"]", "from '../services/knez/KnezClient'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/KnezClient['\"]", "from '../../services/knez/KnezClient'"),
        
        # LogService
        (r"from ['\"]\.\.?/\.\.?/services/LogService['\"]", "from '../services/utils/LogService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/LogService['\"]", "from '../../services/utils/LogService'"),
        
        # MemoryEventSourcingService
        (r"from ['\"]\.\.?/\.\.?/services/MemoryEventSourcingService['\"]", "from '../services/memory/storage/MemoryEventSourcingService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/MemoryEventSourcingService['\"]", "from '../../services/memory/storage/MemoryEventSourcingService'"),
        
        # SessionDatabase
        (r"from ['\"]\.\.?/\.\.?/services/SessionDatabase['\"]", "from '../services/session/SessionDatabase'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/SessionDatabase['\"]", "from '../../services/session/SessionDatabase'"),
        
        # SessionController
        (r"from ['\"]\.\.?/\.\.?/services/SessionController['\"]", "from '../services/session/SessionController'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/SessionController['\"]", "from '../../services/session/SessionController'"),
        
        # PersistenceService
        (r"from ['\"]\.\.?/\.\.?/services/PersistenceService['\"]", "from '../services/infrastructure/persistence/PersistenceService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/PersistenceService['\"]", "from '../../services/infrastructure/persistence/PersistenceService'"),
        
        # TabErrorStore
        (r"from ['\"]\.\.?/\.\.?/services/TabErrorStore['\"]", "from '../services/infrastructure/error/TabErrorStore'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/TabErrorStore['\"]", "from '../../services/infrastructure/error/TabErrorStore'"),
        
        # Preferences
        (r"from ['\"]\.\.?/\.\.?/services/Preferences['\"]", "from '../services/infrastructure/config/Preferences'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/Preferences['\"]", "from '../../services/infrastructure/config/Preferences'"),
        
        # TaqwinActivationService
        (r"from ['\"]\.\.?/\.\.?/services/TaqwinActivationService['\"]", "from '../services/infrastructure/activation/TaqwinActivationService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/TaqwinActivationService['\"]", "from '../../services/infrastructure/activation/TaqwinActivationService'"),
        
        # AnalyticsService
        (r"from ['\"]\.\.?/\.\.?/services/AnalyticsService['\"]", "from '../services/analytics/AnalyticsService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/AnalyticsService['\"]", "from '../../services/analytics/AnalyticsService'"),
        
        # ChatMemorySyncService
        (r"from ['\"]\.\.?/\.\.?/services/ChatMemorySyncService['\"]", "from '../services/chat/sync/ChatMemorySyncService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/ChatMemorySyncService['\"]", "from '../../services/chat/sync/ChatMemorySyncService'"),
        
        # SkillsRegistry
        (r"from ['\"]\.\.?/\.\.?/services/SkillsRegistry['\"]", "from '../services/infrastructure/config/SkillsRegistry'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/SkillsRegistry['\"]", "from '../../services/infrastructure/config/SkillsRegistry'"),
        
        # Troubleshooter
        (r"from ['\"]\.\.?/\.\.?/services/Troubleshooter['\"]", "from '../services/utils/Troubleshooter'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/Troubleshooter['\"]", "from '../../services/utils/Troubleshooter'"),
        
        # TestRunner
        (r"from ['\"]\.\.?/\.\.?/services/TestRunner['\"]", "from '../services/testing/TestRunner'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/TestRunner['\"]", "from '../../services/testing/TestRunner'"),
        
        # MemoryInjectionService
        (r"from ['\"]\.\.?/\.\.?/services/MemoryInjectionService['\"]", "from '../services/memory/MemoryInjectionService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/MemoryInjectionService['\"]", "from '../../services/memory/MemoryInjectionService'"),
        
        # GovernanceService
        (r"from ['\"]\.\.?/\.\.?/services/GovernanceService['\"]", "from '../services/governance/GovernanceService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/GovernanceService['\"]", "from '../../services/governance/GovernanceService'"),
        
        # ExtractionService
        (r"from ['\"]\.\.?/\.\.?/services/ExtractionService['\"]", "from '../services/utils/ExtractionService'"),
        (r"from ['\"]\.\.?/\.\.?/\.\.?/services/ExtractionService['\"]", "from '../../services/utils/ExtractionService'"),
        
        # Internal service imports (within services directory)
        (r"from ['\"]\.\/MemoryEventSourcingService['\"]", "from '../storage/MemoryEventSourcingService'"),
        (r"from ['\"]\.\/MemoryCompressionService['\"]", "from '../compression/MemoryCompressionService'"),
        (r"from ['\"]\.\/ChatMemorySyncService['\"]", "from '../sync/ChatMemorySyncService'"),
        (r"from ['\"]\.\/KnezClient['\"]", "from '../knez/KnezClient'"),
        (r"from ['\"]\.\/LogService['\"]", "from '../utils/LogService'"),
        (r"from ['\"]\.\/SessionDatabase['\"]", "from '../session/SessionDatabase'"),
        (r"from ['\"]\.\/SessionController['\"]", "from '../session/SessionController'"),
        (r"from ['\"]\.\/PersistenceService['\"]", "from '../infrastructure/persistence/PersistenceService'"),
        (r"from ['\"]\.\/TabErrorStore['\"]", "from '../infrastructure/error/TabErrorStore'"),
        (r"from ['\"]\.\/GovernanceService['\"]", "from '../governance/GovernanceService'"),
        (r"from ['\"]\.\/MemoryInjectionService['\"]", "from '../memory/MemoryInjectionService'"),
        (r"from ['\"]\.\/StaticMemoryLoader['\"]", "from '../StaticMemoryLoader'"),
        (r"from ['\"]\.\/ToolExposureService['\"]", "from '../mcp/ToolExposureService'"),
        (r"from ['\"]\.\/ToolResultValidator['\"]", "from '../mcp/ToolResultValidator'"),
        (r"from ['\"]\.\/ToolResultCache['\"]", "from '../mcp/ToolResultCache'"),
        (r"from ['\"]\.\/ToolExecutionService['\"]", "from '../mcp/ToolExecutionService'"),
        (r"from ['\"]\.\/ChatService['\"]", "from '../ChatService'"),
        (r"from ['\"]\.\/Preferences['\"]", "from '../infrastructure/config/Preferences'"),
        (r"from ['\"]\.\/SkillsRegistry['\"]", "from '../infrastructure/config/SkillsRegistry'"),
        (r"from ['\"]\.\/TaqwinActivationService['\"]", "from '../infrastructure/activation/TaqwinActivationService'"),
        (r"from ['\"]\.\/AnalyticsService['\"]", "from '../analytics/AnalyticsService'"),
        (r"from ['\"]\.\/DiagnosticsService['\"]", "from '../analytics/DiagnosticsService'"),
        (r"from ['\"]\.\/UserFeedbackLoop['\"]", "from '../analytics/learning/UserFeedbackLoop'"),
        (r"from ['\"]\.\/AgentLoopService['\"]", "from '../agent/AgentLoopService'"),
        (r"from ['\"]\.\/FailureClassifier['\"]", "from '../agent/FailureClassifier'"),
        (r"from ['\"]\.\/AgentOrchestrator['\"]", "from '../agent/AgentOrchestrator'"),
        (r"from ['\"]\.\/RetryStrategyEngine['\"]", "from '../agent/RetryStrategyEngine'"),
        (r"from ['\"]\.\/RetryStrategy['\"]", "from '../utils/RetryStrategy'"),
        (r"from ['\"]\.\/TimeoutConfig['\"]", "from '../utils/TimeoutConfig'"),
        (r"from ['\"]\.\/OutputInterpreter['\"]", "from '../utils/OutputInterpreter'"),
        (r"from ['\"]\.\/ExtractionService['\"]", "from '../utils/ExtractionService'"),
        (r"from ['\"]\.\/GracefulDegradation['\"]", "from '../utils/GracefulDegradation'"),
        (r"from ['\"]\.\/LatencyOptimizer['\"]", "from '../utils/LatencyOptimizer'"),
        (r"from ['\"]\.\/FallbackStrategy['\"]", "from '../utils/FallbackStrategy'"),
        (r"from ['\"]\.\/ErrorClassifier['\"]", "from '../utils/ErrorClassifier'"),
        (r"from ['\"]\.\/JsonRepair['\"]", "from '../utils/JsonRepair'"),
        (r"from ['\"]\.\/Troubleshooter['\"]", "from '../utils/Troubleshooter'"),
        
        # Additional service imports
        (r"from ['\"]\.\.?/config/features['\"]", "from '../../config/features'"),
        (r"from ['\"]\.\.?/McpTypes['\"]", "from './mcp/McpTypes'"),
        (r"from ['\"]\.\.?/domain/DataContracts['\"]", "from '../domain/DataContracts'"),
        (r"from ['\"]\.\.?/domain/Errors['\"]", "from '../domain/Errors'"),
        (r"from ['\"]\.\.?/utils/observer['\"]", "from '../utils/observer'"),
        (r"from ['\"]\.\.?/utils/health['\"]", "from '../utils/health'"),
        (r"from ['\"]\.\.?/utils/arrayUtils['\"]", "from '../utils/arrayUtils'"),
        
        # Service file specific imports (services importing from domain/utils/config)
        (r"from ['\"]\.\.?/domain/DataContracts['\"]", "from '../../domain/DataContracts'"),
        (r"from ['\"]\.\.?/domain/Errors['\"]", "from '../../domain/Errors'"),
        (r"from ['\"]\.\.?/utils/LogService['\"]", "from '../../utils/LogService'"),
        (r"from ['\"]\.\.?/utils/health['\"]", "from '../../utils/health'"),
        (r"from ['\"]\.\.?/config/features['\"]", "from '../../config/features'"),
        (r"from ['\"]\.\.?/mcp/McpTypes['\"]", "from '../mcp/McpTypes'"),
        (r"from ['\"]\.\.?/StaticMemoryLoader['\"]", "from '../../services/memory/StaticMemoryLoader'"),
        
        # Catch-all for remaining root-level service imports
        (r"from ['\"]\.\.?/\.\.?/services/ChatService['\"]", "from '../services/ChatService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryKnowledgeGraphService['\"]", "from '../services/memory/tracking/MemoryKnowledgeGraphService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryIndexingStrategyService['\"]", "from '../services/memory/indexing/MemoryIndexingStrategyService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryBloomFilterService['\"]", "from '../services/memory/tracking/MemoryBloomFilterService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryTimeSeriesTrackingService['\"]", "from '../services/memory/tracking/MemoryTimeSeriesTrackingService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryShardingStrategyService['\"]", "from '../services/memory/compression/MemoryShardingStrategyService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryCRDTService['\"]", "from '../services/memory/sync/MemoryCRDTService'"),
        (r"from ['\"]\.\.?/\.\.?/services/MemoryMultiLevelCacheService['\"]", "from '../services/memory/sync/MemoryMultiLevelCacheService'"),
        (r"from ['\"]\.\.?/\.\.?/services/SessionIsolationHardener['\"]", "from '../services/session/SessionIsolationHardener'"),
        (r"from ['\"]\.\.?/\.\.?/services/IntentClarification['\"]", "from '../services/ui/intent/IntentClarification'"),
        (r"from ['\"]\.\.?/\.\.?/services/EventBasedUIProtocol['\"]", "from '../services/ui/protocol/EventBasedUIProtocol'"),
        (r"from ['\"]\.\.?/\.\.?/services/SmartPaginationController['\"]", "from '../services/ui/pagination'"),
    ]
    
    files_changed = 0
    
    # Find all TypeScript and TSX files
    for file_path in src_dir.rglob("*.ts"):
        if file_path.is_file():
            fix_file(file_path, replacements)
            files_changed += 1
            
    for file_path in src_dir.rglob("*.tsx"):
        if file_path.is_file():
            fix_file(file_path, replacements)
            files_changed += 1
    
    print(f"Processed {files_changed} files")

def fix_file(file_path, replacements):
    """Apply replacements to a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {file_path}")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    fix_imports()
