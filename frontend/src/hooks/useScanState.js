import { useAppState } from '../contexts/AppStateContext';
import { SCAN_STATES } from '../utils/constants';

export const useScanState = () => {
    const { state, setScanState } = useAppState();

    const startScan = () => {
        setScanState(SCAN_STATES.SCANNING);
    };

    const completeScan = () => {
        setScanState(SCAN_STATES.COMPLETED);
    };

    const resetScan = () => {
        setScanState(SCAN_STATES.IDLE);
    };

    return {
        scanState: state.scanState,
        isScanning: state.scanState === SCAN_STATES.SCANNING,
        isCompleted: state.scanState === SCAN_STATES.COMPLETED,
        isIdle: state.scanState === SCAN_STATES.IDLE,
        startScan,
        completeScan,
        resetScan,
    };
};
