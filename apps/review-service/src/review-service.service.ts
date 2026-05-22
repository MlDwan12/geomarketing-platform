import { Injectable } from '@nestjs/common';

@Injectable()
export class ReviewServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
