import { Injectable } from '@nestjs/common';
import { Request } from 'express';

export interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  platform?: string;
  version?: string;
}

@Injectable()
export class DeviceDetectionService {
  /**
   * Parse user agent string to extract device information
   */
  detectDevice(req: Request): DeviceInfo {
    const userAgent = req.get('User-Agent') || '';
    
    // Simple user agent parsing (you can use a library like ua-parser-js for more accuracy)
    const deviceInfo: DeviceInfo = {
      browser: this.parseBrowser(userAgent),
      os: this.parseOS(userAgent),
      device: this.parseDevice(userAgent),
      platform: this.parsePlatform(userAgent),
      version: this.parseVersion(userAgent),
    };

    return deviceInfo;
  }

  private parseBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  private parseOS(userAgent: string): string {
    if (userAgent.includes('Windows NT 10.0')) return 'Windows 10';
    if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (userAgent.includes('Windows NT 6.1')) return 'Windows 7';
    if (userAgent.includes('Mac OS X')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private parseDevice(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('iPad')) return 'Tablet';
    if (userAgent.includes('iPhone')) return 'Mobile';
    if (userAgent.includes('Android')) return 'Mobile';
    return 'Desktop';
  }

  private parsePlatform(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private parseVersion(userAgent: string): string {
    // Extract version numbers (simplified)
    const versionMatch = userAgent.match(/(\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : 'Unknown';
  }

  /**
   * Generate a human-readable device description
   */
  getDeviceDescription(deviceInfo: DeviceInfo): string {
    const parts: string[] = [];
    
    if (deviceInfo.browser && deviceInfo.browser !== 'Unknown') {
      parts.push(deviceInfo.browser);
    }
    
    if (deviceInfo.os && deviceInfo.os !== 'Unknown') {
      parts.push(`on ${deviceInfo.os}`);  
    }
    
    if (deviceInfo.device && deviceInfo.device !== 'Desktop') {
      parts.push(`(${deviceInfo.device})`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Unknown Device';
  }
}
