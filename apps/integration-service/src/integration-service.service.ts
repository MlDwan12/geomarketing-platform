import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
