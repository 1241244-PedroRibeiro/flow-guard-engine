import { DomainInvariantException } from '../../../../src/domain/common/exceptions';
import { SensorSerialNumber } from '../../../../src/domain/common/SensorSerialNumber';
import { SensorNode } from '../../../../src/domain/sensor/SensorNode';
import { SensorType } from '../../../../src/domain/sensor/SensorType';

describe('SensorNode', () => {
    const register = () =>
        SensorNode.register(
            'line-id',
            SensorSerialNumber.create('sn-vib-9001'),
            SensorType.MOTOR_VIBRATION,
        );

    it('registers an active sensor with normalized serial', () => {
        const s = register();
        expect(s.getSerialNumber().getValue()).toBe('SN-VIB-9001');
        expect(s.getIsActive()).toBe(true);
        expect(s.getLastCalibratedAt()).toBeNull();
        expect(s.getThresholdRule()).toBeNull();
    });

    it('deactivate transitions isActive to false', () => {
        const s = register();
        s.deactivate();
        expect(s.getIsActive()).toBe(false);
        expect(() => s.deactivate()).toThrow(DomainInvariantException);
    });

    it('rejects invalid SensorType', () => {
        expect(() =>
            SensorNode.register(
                'line-id',
                SensorSerialNumber.create('SN-VIB-9001'),
                'INVALID_TYPE' as SensorType,
            ),
        ).toThrow(DomainInvariantException);
    });
});