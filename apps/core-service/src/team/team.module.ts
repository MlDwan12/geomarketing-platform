import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBrand } from '../brand/user-brand.entity';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { TeamInvitation } from './team-invitation.entity';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBrand, User, TeamInvitation]),
    UserModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
